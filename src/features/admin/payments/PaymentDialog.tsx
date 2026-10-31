import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, CheckCircleIcon, CreditCardIcon, ImageBrokenIcon, XCircleIcon } from '@phosphor-icons/react';
import { type AdminPayment, BILLING_ERROR_CODES, rejectPaymentSchema } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { CopyButton } from '../../../components/CopyButton';
import { Dialog } from '../../../components/Dialog';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { Field } from '../../../components/Field';
import { ProtectedImage } from '../../../components/ProtectedImage';
import { Skeleton } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import { isApiError } from '../../../lib/api';
import { adminApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { formatDate, formatPrice } from '../../../lib/format';
import { fieldErrorText } from '../../../lib/forms';
import { useLanguage } from '../../../lib/language';
import { isOnlinePayment, isReviewable, methodName, monthsLabel, PaymentStatusBadge, planName } from '../../billing/labels';
import { nextPeriodStart, periodFrom } from '../../billing/period';
import { invalidateAfterChange, useAdminRestaurantQuery, usePaymentQuery } from '../queries';

type Mode = 'view' | 'approve' | 'reject';

/** A payment with its receipt; pending ones can be approved or rejected here. */
export function PaymentDialog({ paymentId, onClose }: { paymentId: string | null; onClose: () => void }) {
  const { text } = useLanguage();
  const payment = usePaymentQuery(paymentId);
  const [mode, setMode] = useState<Mode>('view');
  const close = () => { setMode('view'); onClose(); };
  const data = payment.data;
  const title = mode === 'approve' ? text('تأكيد قبول التحويل', 'Approve this payment?')
    : mode === 'reject' ? text('رفض التحويل', 'Reject this payment')
      : text('تفاصيل التحويل', 'Payment details');
  if (!paymentId) return null;
  if (!data) {
    return <Dialog key="loading" open onClose={close} title={title} size="wide">
      {payment.isError ? <ErrorPanel error={payment.error} onRetry={() => void payment.refetch()} /> : <div className="skeleton-stack" role="status" aria-label={text('جاري التحميل', 'Loading')}><Skeleton height={24} width="50%" /><Skeleton height={220} /></div>}
    </Dialog>;
  }
  // Online payments are confirmed by Paymob: never approved or rejected here.
  const reviewable = isReviewable(data);
  if (mode === 'approve' && reviewable) return <ApproveView payment={data} onBack={() => setMode('view')} onDone={() => setMode('view')} onClose={close} />;
  if (mode === 'reject' && reviewable) return <RejectView payment={data} onBack={() => setMode('view')} onDone={() => setMode('view')} onClose={close} />;
  return <Dialog key={data.id} open onClose={close} title={title} size="wide"
    footer={reviewable
      ? <>
          <Button variant="danger-outline" icon={<XCircleIcon size={18} aria-hidden="true" />} onClick={() => setMode('reject')}>{text('ارفض', 'Reject')}</Button>
          <Button icon={<CheckCircleIcon size={18} aria-hidden="true" />} onClick={() => setMode('approve')} data-autofocus>{text('اقبل التحويل', 'Approve')}</Button>
        </>
      : <Button variant="secondary" onClick={close} data-autofocus>{text('إغلاق', 'Close')}</Button>}>
    <PaymentView payment={data} />
  </Dialog>;
}

function PaymentView({ payment }: { payment: AdminPayment }) {
  const { text, number, language } = useLanguage();
  return <div className="payment-detail" data-testid="payment-detail">
    <div className="payment-detail-info">
      <div className="payment-detail-head">
        <div>
          <Link className="payment-restaurant link" to={`/admin/restaurants/${payment.restaurant.id}`}>{payment.restaurant.name}</Link>
          <small className="ltr muted">{payment.restaurant.subdomain}</small>
        </div>
        <PaymentStatusBadge status={payment.status} method={payment.method} />
      </div>
      <p className="payment-amount">{formatPrice(payment.amountPiastres, language)}</p>
      <dl className="facts facts-compact">
        <div><dt>{text('الباقة', 'Plan')}</dt><dd>{planName(payment.planCode, text)}</dd></div>
        <div><dt>{text('المدة', 'Length')}</dt><dd>{monthsLabel(payment.months, text, number)}</dd></div>
        <div><dt>{text('طريقة الدفع', 'Method')}</dt><dd>{methodName(payment.method, text)}</dd></div>
        <div><dt>{text('رقم العملية', 'Reference')}</dt><dd className="fact-copy"><span className="ltr">{payment.reference}</span>
          <CopyButton variant="ghost" value={payment.reference} label={text('نسخ', 'Copy')} copiedMessage={text('اتنسخ', 'Copied')} ariaLabel={text('نسخ رقم العملية', 'Copy the reference')} /></dd></div>
        {!isOnlinePayment(payment) && <div><dt>{text('اسم المحوّل', 'Paid by')}</dt><dd>{payment.payerName ?? <span className="muted">—</span>}</dd></div>}
        <div><dt>{isOnlinePayment(payment) ? text('بدأ يوم', 'Started') : text('اتبعت يوم', 'Submitted')}</dt><dd>{formatDate(payment.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
      </dl>
      {payment.status !== 'PENDING' && <div className={`review-result review-${payment.status.toLowerCase()}`} data-testid="review-result">
        {payment.status === 'APPROVED' && payment.period && <p><strong>{text('المدة المدفوعة:', 'Paid period:')}</strong> {formatDate(payment.period.startsAt, language, { dateStyle: 'long' })} – {formatDate(payment.period.endsAt, language, { dateStyle: 'long' })}</p>}
        {payment.status === 'REJECTED' && payment.rejectionReason && <p><strong>{text('سبب الرفض:', 'Reason:')}</strong> {payment.rejectionReason}</p>}
        {payment.status === 'CANCELLED' && (isOnlinePayment(payment)
          ? <p>{text('صاحب المطعم بدأ دفع أونلاين أحدث، فالعملية دي اتلغت.', 'The owner started a newer online payment, so this one was cancelled.')}</p>
          : <p>{text('صاحب المطعم سحب التحويل قبل المراجعة.', 'The owner withdrew this payment before it was reviewed.')}</p>)}
        {payment.status === 'AWAITING_PAYMENT' && <p>{text('صاحب المطعم فتح صفحة الدفع على Paymob ولسه الدفع ما اتأكدش.', 'The owner opened Paymob’s checkout; the payment isn’t confirmed yet.')}</p>}
        {payment.status === 'FAILED' && <p>{text('Paymob مقبلش العملية، ومفيش مدة اتعملت.', 'Paymob declined it; no period was created.')}</p>}
        {payment.reviewedAt && <p className="muted small">{payment.reviewedBy ? text(`راجعه ${payment.reviewedBy}`, `Reviewed by ${payment.reviewedBy}`) : isOnlinePayment(payment) ? text('من Paymob', 'By Paymob') : text('اتراجع', 'Reviewed')} · {formatDate(payment.reviewedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      </div>}
    </div>
    <div className="payment-detail-receipt">
      <h3 className="field-label">{text('الإيصال', 'Receipt')}</h3>
      {isOnlinePayment(payment) && !payment.hasProof
        ? <div className="receipt-frame receipt-state"><CreditCardIcon size={28} aria-hidden="true" /><p>{text('اتدفع أونلاين عن طريق Paymob، فمفيش إيصال ولا مراجعة. رقم العملية هو رقم Paymob.', 'Paid online through Paymob: there is no receipt or review. The reference is Paymob’s.')}</p></div>
        : payment.hasProof
        ? <ProtectedImage path={adminApi.proofPath(payment.id)} alt={text(`إيصال تحويل ${payment.restaurant.name}`, `Transfer receipt from ${payment.restaurant.name}`)} />
        : <div className="receipt-frame receipt-state"><ImageBrokenIcon size={28} aria-hidden="true" /><p>{text('صاحب المطعم مبعتش صورة إيصال. طابق رقم العملية مع حسابك.', 'No receipt was attached. Match the reference against your account.')}</p></div>}
    </div>
  </div>;
}

type ReviewProps = { payment: AdminPayment; onBack: () => void; onDone: () => void; onClose: () => void };

const reviewedElsewhere = (error: unknown) => isApiError(error, BILLING_ERROR_CODES.PAYMENT_NOT_PENDING);

/** Someone else reviewed it first: say so and show the result. */
function useReviewConflict(payment: AdminPayment, onDone: () => void) {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  return (error: unknown) => {
    if (!reviewedElsewhere(error)) return;
    toast.error(text('حد تاني راجع التحويل ده قبلك. حدّثنا البيانات.', 'Someone else already reviewed this payment. The details have been refreshed.'));
    void invalidateAfterChange(queryClient, payment.restaurant.id);
    onDone();
  };
}

function ApproveView({ payment, onBack, onDone, onClose }: ReviewProps) {
  const { text, number, language } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const restaurant = useAdminRestaurantQuery(payment.restaurant.id);
  const onConflict = useReviewConflict(payment, onDone);
  const approve = useMutation({
    mutationFn: () => adminApi.approve(payment.id),
    onError: onConflict,
    onSuccess: async result => {
      toast.success(result.period
        ? text(`اتقبل التحويل. الاشتراك ساري لحد ${formatDate(result.period.endsAt, language, { dateStyle: 'long' })}.`, `Approved. The plan now runs until ${formatDate(result.period.endsAt, language, { dateStyle: 'long' })}.`)
        : text('اتقبل التحويل.', 'Payment approved.'));
      await invalidateAfterChange(queryClient, payment.restaurant.id);
      onDone();
    },
  });
  // Same rule as the API: the new period starts when current coverage ends, or now.
  const preview = restaurant.data ? periodFrom(nextPeriodStart(restaurant.data.entitlements), payment.months) : null;
  return <Dialog open onClose={onClose} busy={approve.isPending} size="small" title={text('تأكيد قبول التحويل', 'Approve this payment?')}
    footer={<>
      <Button variant="secondary" onClick={onBack} disabled={approve.isPending} icon={<ArrowRightIcon size={17} className="directional" aria-hidden="true" />}>{text('رجوع', 'Back')}</Button>
      <Button loading={approve.isPending} onClick={() => approve.mutate()} data-autofocus icon={<CheckCircleIcon size={18} aria-hidden="true" />}>{text('اقبل وفعّل', 'Approve and activate')}</Button>
    </>}>
    <div className="review-confirm">
      {approve.isError && !reviewedElsewhere(approve.error) && <Alert kind="error">{errorMessage(approve.error, text)}</Alert>}
      <p>{text(`اتأكدت إن ${formatPrice(payment.amountPiastres, language)} وصلوا برقم العملية `, `You have confirmed that ${formatPrice(payment.amountPiastres, language)} arrived with reference `)}<strong className="ltr">{payment.reference}</strong>{text('؟', '?')}</p>
      <ul className="tips">
        <li>{text(`هتتعمل مدة مدفوعة ${monthsLabel(payment.months, text, number)} على باقة ${planName(payment.planCode, text)} لمطعم ${payment.restaurant.name}`, `${payment.restaurant.name} gets ${monthsLabel(payment.months, text, number)} of the ${planName(payment.planCode, text)} plan`)}
          {preview ? <> {text('من', 'from')} <strong>{formatDate(preview.startsAt.toISOString(), language, { dateStyle: 'long' })}</strong> {text('لحد', 'to')} <strong>{formatDate(preview.endsAt.toISOString(), language, { dateStyle: 'long' })}</strong>.</> : '.'}</li>
        <li>{text('المدة بتبدأ بعد آخر اشتراك أو تجربة شغالة، أو من النهارده لو مفيش.', 'It starts when the current trial or paid period ends, or today if none is running.')}</li>
        <li>{text('صاحب المطعم هيوصله إيميل بالتأكيد.', 'The owner is emailed a confirmation.')}</li>
      </ul>
    </div>
  </Dialog>;
}

function RejectView({ payment, onBack, onDone, onClose }: ReviewProps) {
  const { text, number } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const onConflict = useReviewConflict(payment, onDone);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const parsed = rejectPaymentSchema.safeParse({ reason });
  const issue = parsed.success ? undefined : parsed.error.issues[0];
  const fieldError = touched && issue ? { message: issue.code === 'too_small' ? '@@min|string|3' : '@@max|string|300' } : undefined;
  const reject = useMutation({
    mutationFn: () => adminApi.reject(payment.id, reason.trim()),
    onError: onConflict,
    onSuccess: async () => {
      toast.success(text('اترفض التحويل وبعتنا السبب لصاحب المطعم.', 'Payment rejected. The owner has been emailed the reason.'));
      await invalidateAfterChange(queryClient, payment.restaurant.id);
      onDone();
    },
  });
  const submit = () => { setTouched(true); if (parsed.success) reject.mutate(); };
  return <Dialog open onClose={onClose} busy={reject.isPending} size="small" title={text('رفض التحويل', 'Reject this payment')} onSubmit={submit}
    footer={<>
      <Button variant="secondary" onClick={onBack} disabled={reject.isPending} icon={<ArrowRightIcon size={17} className="directional" aria-hidden="true" />}>{text('رجوع', 'Back')}</Button>
      <Button type="submit" variant="danger" loading={reject.isPending}>{text('ارفض التحويل', 'Reject payment')}</Button>
    </>}>
    <div className="form">
      {reject.isError && !reviewedElsewhere(reject.error) && <Alert kind="error">{errorMessage(reject.error, text)}</Alert>}
      <p className="muted">{text(`صاحب ${payment.restaurant.name} هيشوف السبب في صفحة الاشتراك وهيوصله بالإيميل، فاكتبه بوضوح.`, `The owner of ${payment.restaurant.name} sees this reason on their subscription page and by email, so make it clear.`)}</p>
      <Field label={text('سبب الرفض', 'Reason')} required error={fieldError ? { message: fieldErrorText(fieldError, text) } : undefined}
        hint={text(`من ٣ لـ ٣٠٠ حرف · ${number(reason.trim().length)}/${number(300)}`, `3–300 characters · ${reason.trim().length}/300`)}>
        <textarea className="textarea" rows={4} maxLength={300} value={reason} onChange={event => setReason(event.target.value)} onBlur={() => setTouched(true)} data-autofocus
          placeholder={text('مثلًا: مفيش تحويل بالرقم ده وصلنا.', 'e.g. No transfer with this reference has arrived.')} />
      </Field>
    </div>
  </Dialog>;
}

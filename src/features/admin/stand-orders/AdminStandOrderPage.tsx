import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowClockwiseIcon, ArrowRightIcon, ArrowSquareOutIcon, CheckCircleIcon, DownloadSimpleIcon, EnvelopeSimpleIcon, MoneyIcon, PhoneIcon, XCircleIcon,
} from '@phosphor-icons/react';
import { type AdminStandOrder, SHOP_ERROR_CODES, type StandOrderLine, type StandOrderStatus } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Dialog } from '../../../components/Dialog';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { Field } from '../../../components/Field';
import { PageHeader } from '../../../components/PageHeader';
import { useProtectedImage } from '../../../components/ProtectedImage';
import { Skeleton, PageSkeleton } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import { isApiError } from '../../../lib/api';
import { adminApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { formatDate, formatPrice } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { afterStandOrderChange, adminKeys, useStandOrderQuery } from '../queries';
import { StandStatusBadge } from './StandOrderBadges';
import {
  canCollectCash, DESIGNS, logoFilename, needsNote, nextStatuses, numberRange, PAYMENT_METHOD_NAMES, PAYMENT_STATUS_NAMES, printColors, PURPOSES, safeLink, SHAPES,
  standActionName, standCount, standStatusName,
} from './stand-orders';

type Text = (ar: string, en: string) => string;

export function AdminStandOrderPage() {
  const { orderId = '' } = useParams();
  const order = useStandOrderQuery(orderId);
  usePageTitle(order.data ? `طلب ${order.data.reference}` : 'طلب ستاند', order.data ? `Order ${order.data.reference}` : 'Stand order');
  if (order.isPending) return <PageSkeleton blocks={3} />;
  if (order.isError) return <div className="page"><BackLink /><ErrorPanel error={order.error} onRetry={() => void order.refetch()} /></div>;
  return <StandOrderDetail order={order.data} />;
}

function BackLink() {
  const { text } = useLanguage();
  return <Link to="/admin/stand-orders" className="back-link"><ArrowRightIcon size={16} className="directional" aria-hidden="true" />{text('كل طلبات الستاندات', 'All stand orders')}</Link>;
}

/** A 409 means someone else changed the order first: show them the current state. */
function useConflictRefresh(order: AdminStandOrder) {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  return (error: unknown) => {
    if (!isApiError(error, SHOP_ERROR_CODES.INVALID_STATUS_CHANGE)) return false;
    toast.error(text('الطلب اتحدّث من مكان تاني، فحدّثنا البيانات. شوف حالته الجديدة.', 'The order was changed elsewhere; we refreshed it. Check its new status.'));
    void queryClient.invalidateQueries({ queryKey: adminKeys.standOrder(order.id) });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'stand-orders', 'list'] });
    return true;
  };
}

function StandOrderDetail({ order }: { order: AdminStandOrder }) {
  const { text, count, language } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<StandOrderStatus | null>(null);
  const [collecting, setCollecting] = useState(false);
  const moves = nextStatuses(order.status);
  const collect = useMutation({
    mutationFn: () => adminApi.updateStandOrder(order.id, { paymentStatus: 'PAID' }),
    onSuccess: async updated => {
      toast.success(text(`سجّلنا تحصيل ${formatPrice(updated.totalPiastres, language)} كاش.`, `Cash of ${formatPrice(updated.totalPiastres, language)} marked as collected.`));
      setCollecting(false);
      await afterStandOrderChange(queryClient, updated);
    },
  });
  return <div className="page stand-order-page" data-testid="stand-order-detail">
    <BackLink />
    <PageHeader title={<span className="stand-title"><span className="ltr">{order.reference}</span> <StandStatusBadge status={order.status} /></span>}
      description={text(`${count(standCount(order), 'stand')} في ${count(order.lines.length, 'design')} · ${formatPrice(order.totalPiastres, language)} · اتطلب ${formatDate(order.createdAt, language, { dateStyle: 'long', timeStyle: 'short' })}`,
        `${count(standCount(order), 'stand')} in ${count(order.lines.length, 'design')} · ${formatPrice(order.totalPiastres, language)} · placed ${formatDate(order.createdAt, language, { dateStyle: 'long', timeStyle: 'short' })}`)}
      actions={moves.length > 0 ? <div className="stand-actions" role="group" aria-label={text('غيّر الحالة', 'Change status')}>
        {moves.map(next => <Button key={next} variant={next === 'CANCELLED' ? 'danger-outline' : 'primary'} data-testid={`move-${next}`}
          icon={next === 'CANCELLED' ? <XCircleIcon size={18} aria-hidden="true" /> : <CheckCircleIcon size={18} aria-hidden="true" />}
          onClick={() => setTarget(next)}>{standActionName(next, text)}</Button>)}
      </div> : undefined} />

    {order.status === 'AWAITING_PAYMENT' && <Alert kind="info" live={false} title={text('مستني الدفع الأونلاين', 'Waiting for online payment')}>
      {text('العميل لسه مدفعش على Paymob. الطلب بيتحوّل «جديد» لوحده أول ما الدفع يتأكد، وبيتلغي لوحده بعد يومين لو ما اتدفعش.',
        'The customer hasn’t paid on Paymob yet. The order becomes “New” by itself once payment is confirmed, and is cancelled automatically after two days if not.')}
    </Alert>}
    {order.status === 'NEW' && <Alert kind="warning" live={false} title={text('كلّم العميل وأكّد الطلب', 'Call the customer to confirm')}>
      {text('راجع التصميمات واللينكات مع العميل في التليفون قبل التصنيع، وبعدين دوس «أكّد الطلب».', 'Go over the designs and links with the customer by phone before production, then select “Confirm order”.')}
    </Alert>}

    <div className="detail-grid">
      <div className="stand-main">
        <section className="section" aria-labelledby="lines-title">
          <div className="section-head"><div><h2 id="lines-title">{text('التصميمات', 'Designs')}</h2><p>{text('كل تصميم بالشكل والألوان والكلام اللي هيتطبع عليه.', 'Each design with its shape, colours and printed text.')}</p></div></div>
          <ol className="stand-lines">{order.lines.map((line, index) => <LineCard key={line.id} order={order} line={line} index={index} />)}</ol>
        </section>
        <Totals order={order} />
      </div>
      <div className="stand-side">
        <Customer order={order} />
        <section className="section" aria-labelledby="payment-title">
          <div className="section-head"><div><h2 id="payment-title">{text('الدفع', 'Payment')}</h2></div></div>
          <dl className="facts facts-compact">
            <div><dt>{text('الطريقة', 'Method')}</dt><dd>{text(...PAYMENT_METHOD_NAMES[order.paymentMethod])}</dd></div>
            <div><dt>{text('الحالة', 'Status')}</dt><dd><span className={`stand-payment-state ${order.paymentStatus === 'PAID' ? 'is-paid' : 'is-unpaid'}`} data-testid="stand-payment-status">{text(...PAYMENT_STATUS_NAMES[order.paymentStatus])}</span></dd></div>
            {order.paidAt && <div><dt>{text('اتدفع يوم', 'Paid on')}</dt><dd>{formatDate(order.paidAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>}
          </dl>
          {canCollectCash(order) && <div className="form-actions stand-collect">
            <Button variant="secondary" icon={<MoneyIcon size={18} aria-hidden="true" />} onClick={() => setCollecting(true)} data-testid="collect-cash">{text('تم تحصيل الكاش', 'Cash collected')}</Button>
            <small className="muted">{text('بعد ما المندوب يسلّم الفلوس.', 'Once the courier hands over the money.')}</small>
          </div>}
        </section>
        <AdminNote order={order} />
        <History order={order} />
      </div>
    </div>

    {target && <StatusDialog key={target} order={order} target={target} onClose={() => setTarget(null)} />}
    <ConfirmDialog open={collecting} tone="primary" busy={collect.isPending} onCancel={() => setCollecting(false)} onConfirm={() => collect.mutate()}
      title={text('تم تحصيل الكاش؟', 'Cash collected?')} confirmLabel={text('أيوه، اتحصّل', 'Yes, collected')}
      description={text(`هنسجّل إن ${formatPrice(order.totalPiastres, language)} اتدفعوا كاش للطلب ${order.reference}.`, `This records ${formatPrice(order.totalPiastres, language)} paid in cash for order ${order.reference}.`)}>
      {collect.isError && <Alert kind="error">{errorMessage(collect.error, text)}</Alert>}
    </ConfirmDialog>
  </div>;
}

function Customer({ order }: { order: AdminStandOrder }) {
  const { text } = useLanguage();
  return <section className="section" aria-labelledby="customer-title">
    <div className="section-head"><div><h2 id="customer-title">{text('العميل', 'Customer')}</h2></div></div>
    <dl className="facts facts-compact">
      <div><dt>{text('الاسم', 'Name')}</dt><dd>{order.customerName}</dd></div>
      <div><dt>{text('الموبايل', 'Phone')}</dt><dd><a className="link ltr contact-link" href={`tel:${order.phone}`} data-testid="customer-phone"><PhoneIcon size={16} aria-hidden="true" />{order.phone}</a></dd></div>
      <div><dt>{text('الإيميل', 'Email')}</dt><dd>{order.email
        ? <a className="link ltr contact-link" href={`mailto:${order.email}`}><EnvelopeSimpleIcon size={16} aria-hidden="true" />{order.email}</a>
        : <span className="muted">—</span>}</dd></div>
      <div><dt>{text('المدينة', 'City')}</dt><dd>{order.city}</dd></div>
      <div className="fact-wide"><dt>{text('العنوان', 'Address')}</dt><dd>{order.address}</dd></div>
      <div><dt>{text('لغة الرسايل', 'Language')}</dt><dd>{order.language === 'ar' ? text('عربي', 'Arabic') : text('إنجليزي', 'English')}</dd></div>
    </dl>
    {order.customerNotes && <div className="customer-notes"><strong>{text('ملاحظات العميل', 'Customer notes')}</strong><p>{order.customerNotes}</p></div>}
  </section>;
}

function LineCard({ order, line, index }: { order: AdminStandOrder; line: StandOrderLine; index: number }) {
  const { text, number, language } = useLanguage();
  const colors = printColors(line);
  const range = numberRange(line);
  const link = safeLink(line.url);
  return <li className="stand-line" data-testid="stand-line">
    <div className="stand-line-head">
      <h3>{text(`تصميم ${number(index + 1)}`, `Design ${index + 1}`)}</h3>
      <span className="stand-line-total">{number(line.quantity)} × {formatPrice(line.unitPricePiastres, language)} = <strong>{formatPrice(line.lineTotalPiastres, language)}</strong></span>
    </div>
    <div className="stand-line-body">
      <div className="stand-preview" style={{ background: colors.background, color: colors.ink }} aria-hidden="true">
        <span className="stand-preview-accent" style={{ background: colors.accent }} />
        <strong>{line.brand || '—'}</strong>
        <span className="stand-preview-qr" style={{ borderColor: colors.ink }} />
        <small>{line.caption}</small>
      </div>
      <dl className="facts stand-facts">
        <div><dt>{text('الشكل', 'Shape')}</dt><dd>{text(...SHAPES[line.shape])}</dd></div>
        <div><dt>{text('التصميم', 'Design')}</dt><dd>{text(...DESIGNS[line.design].label)}{colors.custom && <> · {text('ألوان مخصوصة', 'custom colours')}</>}</dd></div>
        <div className="fact-wide"><dt>{text('الألوان', 'Colours')}</dt><dd className="stand-swatches">
          <Swatch color={colors.background} label={text('الخلفية', 'Background')} />
          <Swatch color={colors.ink} label={text('الكتابة', 'Ink')} />
        </dd></div>
        <div><dt>{text('الغرض', 'Purpose')}</dt><dd>{text(...PURPOSES[line.purpose])}</dd></div>
        <div className="fact-wide"><dt>{text('اللينك اللي في الكود', 'Link in the code')}</dt><dd>{link
          ? <a className="link ltr stand-url" href={link} target="_blank" rel="noreferrer noopener" data-testid="line-url">{line.url}<ArrowSquareOutIcon size={14} aria-hidden="true" className="inline-icon" /></a>
          : <span className="ltr stand-url">{line.url}</span>}</dd></div>
        <div><dt>{text('الاسم على الستاند', 'Brand')}</dt><dd>{line.brand || <span className="muted">—</span>}</dd></div>
        <div><dt>{text('الجملة', 'Caption')}</dt><dd>{line.caption || <span className="muted">—</span>}</dd></div>
        <div><dt>{text('الترقيم', 'Numbering')}</dt><dd>{range
          ? text(`من ${number(range.from)} لـ ${number(range.to)}`, `${range.from} to ${range.to}`)
          : text('من غير ترقيم', 'Not numbered')}</dd></div>
        <div><dt>NFC</dt><dd>{line.nfc ? text('أيوه، بشريحة NFC', 'Yes, with an NFC chip') : text('لا', 'No')}</dd></div>
        <div><dt>{text('الكمية', 'Quantity')}</dt><dd>{number(line.quantity)}</dd></div>
        <div><dt>{text('سعر الستاند', 'Unit price')}</dt><dd>{formatPrice(line.unitPricePiastres, language)}</dd></div>
      </dl>
    </div>
    {line.notes && <p className="stand-line-notes"><strong>{text('ملاحظات:', 'Notes:')}</strong> {line.notes}</p>}
    {line.hasLogo && <LineLogo order={order} line={line} index={index} />}
  </li>;
}

function Swatch({ color, label }: { color: string; label: string }) {
  return <span className="swatch-chip"><span className="swatch" style={{ background: color }} aria-hidden="true" />{label} <span className="ltr">{color}</span></span>;
}

/** The uploaded logo: fetched with the admin's token (a plain <img src> cannot send it), previewed and downloadable. */
function LineLogo({ order, line, index }: { order: AdminStandOrder; line: StandOrderLine; index: number }) {
  const { text, number } = useLanguage();
  const image = useProtectedImage(adminApi.standLogoPath(order.id, line.id));
  const filename = logoFilename(order.reference, index + 1);
  return <div className="stand-logo">
    <strong className="field-label">{text('اللوجو', 'Logo')}</strong>
    {image.error
      ? <div className="stand-logo-frame receipt-state" role="alert"><p>{errorMessage(image.error, text)}</p>
          <Button small variant="secondary" icon={<ArrowClockwiseIcon size={16} aria-hidden="true" />} onClick={image.retry}>{text('حاول تاني', 'Try again')}</Button></div>
      : image.isLoading || !image.url
        ? <div className="stand-logo-frame" role="status" aria-label={text('بنحمّل اللوجو', 'Loading the logo')}><Skeleton height="100%" radius={0} /></div>
        : <div className="stand-logo-row">
            <div className="stand-logo-frame"><img src={image.url} alt={text(`لوجو تصميم ${number(index + 1)}`, `Logo of design ${index + 1}`)} data-testid="line-logo" /></div>
            <div className="form-actions">
              <a className="button button-secondary button-small" href={image.url} download={filename}><DownloadSimpleIcon size={17} aria-hidden="true" />{text('نزّل اللوجو', 'Download logo')}</a>
              <a className="button button-ghost button-small" href={image.url} target="_blank" rel="noreferrer"><ArrowSquareOutIcon size={17} aria-hidden="true" />{text('افتح بالحجم الكامل', 'Open full size')}</a>
            </div>
          </div>}
  </div>;
}

function Totals({ order }: { order: AdminStandOrder }) {
  const { text, language } = useLanguage();
  return <section className="section" aria-labelledby="totals-title">
    <div className="section-head"><div><h2 id="totals-title">{text('الحساب', 'Totals')}</h2></div></div>
    <dl className="totals">
      <div><dt>{text('الستاندات', 'Stands')}</dt><dd>{formatPrice(order.subtotalPiastres, language)}</dd></div>
      <div><dt>{text('التوصيل', 'Delivery')}</dt><dd>{order.deliveryFeePiastres === null
        ? <span className="muted">{text('يتأكد بالتليفون', 'Confirmed by phone')}</span>
        : formatPrice(order.deliveryFeePiastres, language)}</dd></div>
      <div className="totals-grand"><dt>{text('الإجمالي', 'Total')}</dt><dd data-testid="stand-total">{formatPrice(order.totalPiastres, language)}</dd></div>
    </dl>
    {order.deliveryFeePiastres === null && <p className="field-hint">{text('الإجمالي من غير التوصيل؛ اتفق على رسومه مع العميل في التليفون.', 'The total excludes delivery; agree the fee with the customer by phone.')}</p>}
  </section>;
}

function AdminNote({ order }: { order: AdminStandOrder }) {
  const { text, number } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const saved = order.adminNote ?? '';
  const [note, setNote] = useState(saved);
  const [base, setBase] = useState(saved);
  // Someone else saved a note meanwhile: follow it unless this one has unsaved edits.
  if (saved !== base) { setBase(saved); if (note === base) setNote(saved); }
  const save = useMutation({
    mutationFn: () => adminApi.updateStandOrder(order.id, { adminNote: note.trim() === '' ? null : note.trim() }),
    onSuccess: async updated => {
      toast.success(text('اتحفظت الملاحظة', 'Note saved'));
      setNote(updated.adminNote ?? '');
      await afterStandOrderChange(queryClient, updated);
    },
  });
  const dirty = note.trim() !== saved.trim();
  return <form className="section form" aria-labelledby="note-title" noValidate onSubmit={event => { event.preventDefault(); if (dirty) save.mutate(); }}>
    <div className="section-head"><div><h2 id="note-title">{text('ملاحظة داخلية', 'Internal note')}</h2><p>{text('للفريق بس؛ العميل مش بيشوفها.', 'For the team only; never shown to the customer.')}</p></div></div>
    {save.isError && <Alert kind="error">{errorMessage(save.error, text)}</Alert>}
    <Field label={text('الملاحظة', 'Note')} optional hint={text(`${number(note.trim().length)}/${number(1000, { useGrouping: false })}`, `${note.trim().length}/1000`)}>
      <textarea className="textarea" rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)}
        placeholder={text('مثلًا: العميل عايز التسليم بعد الساعة ٥.', 'e.g. The customer wants delivery after 5 pm.')} />
    </Field>
    <div className="form-actions form-actions-end">
      <Button variant="secondary" small disabled={!dirty || save.isPending} onClick={() => setNote(saved)}>{text('تراجع', 'Discard')}</Button>
      <Button type="submit" small loading={save.isPending} disabled={!dirty}>{text('احفظ الملاحظة', 'Save note')}</Button>
    </div>
  </form>;
}

function History({ order }: { order: AdminStandOrder }) {
  const { text, language } = useLanguage();
  const last = order.statusHistory.length - 1;
  return <section className="section" aria-labelledby="history-title">
    <div className="section-head"><div><h2 id="history-title">{text('سجل الحالة', 'Status history')}</h2></div></div>
    {order.statusHistory.length === 0
      ? <p className="muted empty-line">{text('مفيش تغييرات لسه.', 'No changes yet.')}</p>
      : <ol className="timeline" data-testid="stand-history">{order.statusHistory.map((entry, index) => <li key={`${entry.at}-${index}`} className={`timeline-item ${index === last ? 'is-current' : 'is-past'}`}>
          <span className="timeline-dot" aria-hidden="true" />
          <div className="timeline-body">
            <div className="timeline-head"><strong>{standStatusName(entry.status, text)}</strong>{index === last && <span className="visually-hidden">{text('(الحالة الحالية)', '(current status)')}</span>}</div>
            <span className="timeline-dates">{formatDate(entry.at, language, { dateStyle: 'medium', timeStyle: 'short' })} · {entry.by ?? text('العميل أو النظام', 'Customer or system')}</span>
            {entry.note && <p className="timeline-note">{entry.note}</p>}
          </div>
        </li>)}</ol>}
  </section>;
}

/** Moving the order on (optional note) or cancelling it (reason required); both are recorded in its history. */
function StatusDialog({ order, target, onClose }: { order: AdminStandOrder; target: StandOrderStatus; onClose: () => void }) {
  const { text, number } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const onConflict = useConflictRefresh(order);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const required = needsNote(target);
  const missing = required && note.trim() === '';
  const change = useMutation({
    mutationFn: () => adminApi.updateStandOrderStatus(order.id, { status: target, ...(note.trim() ? { note: note.trim() } : {}) }),
    onSuccess: async updated => {
      toast.success(text(`الطلب ${order.reference} بقى «${standStatusName(updated.status, text)}».`, `Order ${order.reference} is now “${standStatusName(updated.status, text)}”.`));
      onClose();
      await afterStandOrderChange(queryClient, updated);
    },
    onError: error => { if (onConflict(error)) onClose(); },
  });
  const submit = () => { setTouched(true); if (!missing) change.mutate(); };
  return <Dialog open onClose={onClose} busy={change.isPending} size="small" onSubmit={submit}
    title={target === 'CANCELLED' ? text(`إلغاء الطلب ${order.reference}`, `Cancel order ${order.reference}`) : text(`${standActionName(target, text)}؟`, `${standActionName(target, text)}?`)}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={change.isPending}>{text('رجوع', 'Back')}</Button>
      <Button type="submit" variant={target === 'CANCELLED' ? 'danger' : 'primary'} loading={change.isPending} data-testid="confirm-status">{standActionName(target, text)}</Button>
    </>}>
    <div className="form">
      {change.isError && !isApiError(change.error, SHOP_ERROR_CODES.INVALID_STATUS_CHANGE) && <Alert kind="error">{errorMessage(change.error, text)}</Alert>}
      <p className="muted">{statusHint(target, text)}</p>
      <Field label={required ? text('سبب الإلغاء', 'Reason for cancelling') : text('ملاحظة', 'Note')} required={required} optional={!required}
        error={touched && missing ? { message: text('اكتب سبب الإلغاء.', 'Say why the order is cancelled.') } : undefined}
        hint={text(`بتظهر في سجل الطلب · ${number(note.trim().length)}/${number(300)}`, `Shown in the order’s history · ${note.trim().length}/300`)}>
        <textarea className="textarea" rows={3} maxLength={300} value={note} onChange={event => setNote(event.target.value)} onBlur={() => setTouched(true)} data-autofocus
          placeholder={required ? text('مثلًا: العميل لغى في التليفون.', 'e.g. The customer cancelled by phone.') : ''} />
      </Field>
    </div>
  </Dialog>;
}

function statusHint(target: StandOrderStatus, text: Text): string {
  switch (target) {
    case 'CONFIRMED': return text('اتأكدت من التصميمات والعنوان مع العميل في التليفون؟', 'Have you confirmed the designs and address with the customer by phone?');
    case 'IN_PRODUCTION': return text('الطلب هيدخل التصنيع. اتأكد إن اللوجوهات واللينكات تمام.', 'The order goes into production. Make sure the logos and links are right.');
    case 'SHIPPED': return text('الطلب اتسلّم لشركة الشحن أو المندوب.', 'The order has been handed to the courier.');
    case 'DELIVERED': return text('العميل استلم الطلب.', 'The customer has received the order.');
    case 'CANCELLED': return text('الإلغاء نهائي. السبب بيتسجّل في سجل الطلب.', 'Cancelling is final. The reason is recorded in the order’s history.');
    default: return '';
  }
}

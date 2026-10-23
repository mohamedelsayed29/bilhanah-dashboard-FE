import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BankIcon, CalendarCheckIcon, DeviceMobileIcon, LightningIcon, PaperPlaneTiltIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import {
  BILLING_ERROR_CODES, type BillingSummary, type ImageSet, type PaymentMethod, type PaymentInstructions, submitPaymentSchema,
} from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { CopyButton } from '../../../components/CopyButton';
import { Field } from '../../../components/Field';
import { ImageUpload } from '../../../components/ImageUpload';
import { useToast } from '../../../components/Toast';
import { isApiError } from '../../../lib/api';
import { billingApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { formatDate, formatPrice, piastresToInput } from '../../../lib/format';
import { applyServerIssues, emptyToNull, schemaResolver } from '../../../lib/forms';
import { useLanguage } from '../../../lib/language';
import { methodName, monthsLabel, PlanFeatureList, planName } from '../../billing/labels';
import { periodFrom, startsLater } from '../../billing/period';
import { queryKeys } from '../queries';

const METHOD_ICONS: Record<PaymentMethod, Icon> = { INSTAPAY: LightningIcon, VODAFONE_CASH: DeviceMobileIcon, BANK_TRANSFER: BankIcon };

/** Choose a plan and length, pay by one of the offered methods, then send the transfer details for review. */
export function PaymentForm({ summary }: { summary: BillingSummary }) {
  const { text, number, language } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [proof, setProof] = useState<ImageSet | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const defaultPlan = summary.access.planCode && summary.plans.some(plan => plan.code === summary.access.planCode) ? summary.access.planCode : summary.plans[0]?.code ?? 'MENU';
  const { control, register, handleSubmit, watch, setError: setFieldError, formState: { errors, isSubmitting } } = useForm({
    resolver: schemaResolver(submitPaymentSchema),
    defaultValues: { planCode: defaultPlan, months: 1 as const, method: summary.availableMethods[0], reference: '', payerName: '' },
  });
  const [planCode, months, method] = watch(['planCode', 'months', 'method']);
  const plan = summary.plans.find(entry => entry.code === planCode) ?? summary.plans[0];
  const total = (plan?.priceMonthlyPiastres ?? 0) * months;
  const period = periodFrom(summary.nextPeriodStartsAt, months);
  const later = startsLater(summary.nextPeriodStartsAt);
  const noMethods = summary.availableMethods.length === 0;

  const submit = useMutation({
    mutationFn: billingApi.submit,
    onSuccess: async () => {
      toast.success(text('وصلنا التحويل، وهنراجعه في أقرب وقت.', 'Payment sent. We will review it shortly.'));
      await queryClient.invalidateQueries({ queryKey: queryKeys.billing });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      await submit.mutateAsync({ ...values, proofId: proof?.id ?? null });
    } catch (caught) {
      if (isApiError(caught, BILLING_ERROR_CODES.PAYMENT_ALREADY_PENDING)) {
        // Sent from another device or tab: show that one instead.
        toast.error(errorMessage(caught, text));
        await queryClient.invalidateQueries({ queryKey: queryKeys.billing });
        return;
      }
      if (isApiError(caught, BILLING_ERROR_CODES.PAYMENT_METHOD_UNAVAILABLE)) void queryClient.invalidateQueries({ queryKey: queryKeys.billing });
      if (!applyServerIssues(caught, setFieldError, ['reference', 'payerName'] as const)) setError(caught);
    }
  });

  return <form className="pay-flow" onSubmit={onSubmit} noValidate aria-labelledby="pay-title">
    <h2 id="pay-title" className="visually-hidden">{text('ادفع أو جدّد', 'Pay or renew')}</h2>

    <section className="card card-padded" aria-labelledby="step-plan">
      <div className="card-header"><div>
        <h3 id="step-plan" className="step-title"><span className="step-number" aria-hidden="true">{number(1)}</span>{text('اختار الباقة', 'Choose a plan')}</h3>
        <p>{text('الأسعار بالشهر. تقدر تغيّر الباقة في أي تجديد.', 'Prices are per month. You can switch plans at any renewal.')}</p>
      </div></div>
      <Controller control={control} name="planCode" render={({ field }) => <div className="plan-options" role="radiogroup" aria-labelledby="step-plan">
        {summary.plans.map(option => {
          const current = summary.access.planCode === option.code && (summary.access.status === 'PAID' || summary.access.status === 'TRIAL');
          return <label key={option.code} className={`plan-option ${field.value === option.code ? 'is-selected' : ''}`}>
            <input type="radio" name={field.name} value={option.code} checked={field.value === option.code} onChange={() => field.onChange(option.code)} onBlur={field.onBlur} className="visually-hidden"
              aria-label={text(`${planName(option.code, text)}، ${formatPrice(option.priceMonthlyPiastres, language)} في الشهر`, `${planName(option.code, text)}, ${formatPrice(option.priceMonthlyPiastres, language)} a month`)} />
            <span className="plan-option-head">
              <strong>{planName(option.code, text)}</strong>
              {current && <span className="badge badge-muted">{summary.access.status === 'TRIAL' ? text('باقة التجربة', 'Trial plan') : text('باقتك', 'Current')}</span>}
            </span>
            <span className="plan-option-price"><strong>{formatPrice(option.priceMonthlyPiastres, language)}</strong> <small>{text('/ شهر', '/ month')}</small></span>
            <PlanFeatureList code={option.code} />
          </label>;
        })}
      </div>} />
    </section>

    <section className="card card-padded" aria-labelledby="step-months">
      <div className="card-header"><div>
        <h3 id="step-months" className="step-title"><span className="step-number" aria-hidden="true">{number(2)}</span>{text('اختار المدة', 'Choose how long')}</h3>
        <p>{text('بتدفع مرة واحدة للمدة كلها، ومفيش تجديد تلقائي.', 'You pay once for the whole period. Nothing renews automatically.')}</p>
      </div></div>
      <Controller control={control} name="months" render={({ field }) => <div className="segmented months-options" role="radiogroup" aria-labelledby="step-months">
        {summary.months.map(option => <label key={option}>
          <input type="radio" name={field.name} value={option} checked={field.value === option} onChange={() => field.onChange(option)} onBlur={field.onBlur} />
          {monthsLabel(option, text, number)}
        </label>)}
      </div>} />
      <div className="order-summary" aria-live="polite" data-testid="order-summary">
        <div className="order-total">
          <span>{text('الإجمالي', 'Total')}</span>
          <strong data-testid="order-total">{formatPrice(total, language)}</strong>
          {plan && <small>{formatPrice(plan.priceMonthlyPiastres, language)} × {monthsLabel(months, text, number)}</small>}
        </div>
        <div className="order-period">
          <CalendarCheckIcon size={22} aria-hidden="true" />
          <p>
            {text('اشتراكك الجديد هيبدأ من', 'Your new period would run from')} <strong>{formatDate(period.startsAt.toISOString(), language, { dateStyle: 'long' })}</strong> {text('لحد', 'to')} <strong>{formatDate(period.endsAt.toISOString(), language, { dateStyle: 'long' })}</strong>.
            {later && <span className="order-note"> {summary.access.status === 'TRIAL'
              ? text('بيبدأ بعد ما التجربة تخلص، فأيام التجربة الباقية محفوظة.', 'It starts after your trial, so your remaining trial days are kept.')
              : text('بيبدأ بعد ما اشتراكك الحالي يخلص.', 'It starts when your current period ends.')}</span>}
          </p>
        </div>
      </div>
    </section>

    {noMethods
      ? <Alert kind="info" live={false} title={text('الدفع لسه مش متاح', 'Payments are not open yet')}>
          {text('لسه بنجهز طرق الدفع. تواصل معانا وهنساعدك تشترك.', 'We are still setting up payment methods. Please contact us and we will help you subscribe.')}
        </Alert>
      : <>
          <section className="card card-padded" aria-labelledby="step-method">
            <div className="card-header"><div>
              <h3 id="step-method" className="step-title"><span className="step-number" aria-hidden="true">{number(3)}</span>{text('حوّل المبلغ', 'Send the money')}</h3>
              <p>{text('اختار طريقة الدفع، وحوّل المبلغ بالظبط على البيانات دي.', 'Pick a method and transfer the exact amount to these details.')}</p>
            </div></div>
            <div className="method-layout">
              <Controller control={control} name="method" render={({ field }) => <div className="method-options" role="radiogroup" aria-labelledby="step-method">
                {summary.availableMethods.map(option => {
                  const MethodIcon = METHOD_ICONS[option];
                  return <label key={option} className={`method-option ${field.value === option ? 'is-selected' : ''}`}>
                    <input type="radio" name={field.name} value={option} checked={field.value === option} onChange={() => field.onChange(option)} onBlur={field.onBlur} className="visually-hidden" />
                    <span className="method-icon" aria-hidden="true"><MethodIcon size={22} /></span>
                    <strong>{methodName(option, text)}</strong>
                  </label>;
                })}
              </div>} />
              {method && <Instructions method={method} instructions={summary.instructions} total={total} />}
            </div>
          </section>

          <section className="card card-padded" aria-labelledby="step-details">
            <div className="card-header"><div>
              <h3 id="step-details" className="step-title"><span className="step-number" aria-hidden="true">{number(4)}</span>{text('ابعت بيانات التحويل', 'Send the transfer details')}</h3>
              <p>{text('بنطابقها مع التحويل اللي وصلنا.', 'We match them against the transfer we receive.')}</p>
            </div></div>
            <div className="details-layout">
              <div className="form">
                {error !== null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
                <Field label={text('رقم العملية', 'Transfer reference')} error={errors.reference} required
                  hint={text('من رسالة التأكيد أو الإيصال، زي رقم العملية في إنستاباي.', 'From the confirmation message or receipt, e.g. the InstaPay transaction number.')}>
                  <input className="input" dir="ltr" autoComplete="off" maxLength={100} {...register('reference')} />
                </Field>
                <Field label={text('اسم صاحب الحساب اللي حوّل', 'Name of the sender')} error={errors.payerName} optional
                  hint={text('لو التحويل من حساب باسم حد تاني.', 'If the transfer came from someone else’s account.')}>
                  <input className="input" autoComplete="name" maxLength={80} {...register('payerName', { setValueAs: emptyToNull })} />
                </Field>
              </div>
              <ImageUpload kind="PAYMENT_PROOF" value={proof} onChange={setProof} onBusyChange={setUploading} localPreview fit="contain" aspect="4 / 3"
                label={text('صورة الإيصال', 'Receipt photo')} emptyLabel={text('ارفع صورة الإيصال', 'Upload the receipt')}
                hint={text('اختياري، بس بيسرّع المراجعة. سكرين شوت لرسالة التأكيد كفاية.', 'Optional, but it speeds up the review. A screenshot of the confirmation is enough.')} />
            </div>
            <div className="submit-row">
              <p className="muted">{text(`هتبعت ${formatPrice(total, language)} عن ${planName(planCode, text)} لمدة ${monthsLabel(months, text, number)}.`,
                `You are sending ${formatPrice(total, language)} for ${planName(planCode, text)}, ${monthsLabel(months, text, number)}.`)}</p>
              <Button type="submit" loading={isSubmitting} disabled={uploading} icon={<PaperPlaneTiltIcon size={18} aria-hidden="true" />}>
                {text('ابعت للمراجعة', 'Send for review')}
              </Button>
            </div>
          </section>
        </>}
  </form>;
}

function Instructions({ method, instructions, total }: { method: PaymentMethod; instructions: PaymentInstructions; total: number }) {
  const { text, language } = useLanguage();
  const copied = text('اتنسخ', 'Copied');
  const rows: { label: string; value: string | null; copy?: boolean }[] = method === 'INSTAPAY'
    ? [{ label: text('عنوان إنستاباي', 'InstaPay address'), value: instructions.instapayAddress, copy: true }]
    : method === 'VODAFONE_CASH'
      ? [{ label: text('رقم فودافون كاش', 'Vodafone Cash number'), value: instructions.vodafoneCashNumber, copy: true }]
      : [
          { label: text('البنك', 'Bank'), value: instructions.bankName },
          { label: text('اسم الحساب', 'Account name'), value: instructions.bankAccountName },
          { label: text('رقم الحساب / IBAN', 'Account number / IBAN'), value: instructions.bankAccountNumber, copy: true },
        ];
  const notes = language === 'ar' ? instructions.notesAr ?? instructions.notesEn : instructions.notesEn ?? instructions.notesAr;
  return <div className="instructions" data-testid="payment-instructions">
    <dl>
      <div className="instructions-row instructions-amount">
        <dt>{text('المبلغ المطلوب', 'Amount to send')}</dt>
        <dd><strong>{formatPrice(total, language)}</strong>
          <CopyButton value={piastresToInput(total)} label={text('نسخ', 'Copy')} copiedMessage={copied} ariaLabel={text('انسخ المبلغ', 'Copy the amount')} /></dd>
      </div>
      {rows.filter(row => row.value).map(row => <div className="instructions-row" key={row.label}>
        <dt>{row.label}</dt>
        <dd><span className="ltr">{row.value}</span>
          {row.copy && <CopyButton value={row.value!} label={text('نسخ', 'Copy')} copiedMessage={copied} ariaLabel={text(`انسخ ${row.label}`, `Copy the ${row.label.toLowerCase()}`)} />}</dd>
      </div>)}
    </dl>
    {notes && <p className="instructions-notes">{notes}</p>}
  </div>;
}

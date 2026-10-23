import { useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BankIcon, DeviceMobileIcon, LightningIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { type AdminSettings, type PaymentInstructions, type PlanCode, updatePaymentSettingsSchema } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { Field } from '../../../components/Field';
import { PageHeader } from '../../../components/PageHeader';
import { PageSkeleton } from '../../../components/Skeleton';
import { Switch } from '../../../components/Switch';
import { useToast } from '../../../components/Toast';
import { adminApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { egpToPiastres, formatPrice, piastresToInput } from '../../../lib/format';
import { applyServerIssues, schemaResolver } from '../../../lib/forms';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { planName } from '../../billing/labels';
import { adminKeys, useAdminSettingsQuery } from '../queries';

export function AdminSettingsPage() {
  const { text } = useLanguage();
  usePageTitle('الإعدادات', 'Settings');
  const settings = useAdminSettingsQuery();
  if (settings.isPending) return <PageSkeleton blocks={3} />;
  if (settings.isError) return <div className="page"><ErrorPanel error={settings.error} onRetry={() => void settings.refetch()} /></div>;
  return <div className="page">
    <PageHeader title={text('الإعدادات', 'Settings')} description={text('بيانات الدفع اللي بتظهر لأصحاب المطاعم، والتجربة المجانية، وأسعار الباقات.', 'Payment details shown to owners, the free trial and plan prices.')} />
    <PaymentSettings payment={settings.data.payment} />
    <div className="settings-columns">
      <TrialSettings settings={settings.data} />
      <PlanPrices plans={settings.data.plans} />
    </div>
  </div>;
}

/** After a save: the new settings everywhere, and the change in the audit log. */
function useSaved() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { text } = useLanguage();
  return (settings: AdminSettings, message?: string) => {
    queryClient.setQueryData(adminKeys.settings, settings);
    void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    toast.success(message ?? text('اتحفظت التغييرات', 'Changes saved'));
  };
}

const PAYMENT_FIELDS = ['instapayAddress', 'vodafoneCashNumber', 'bankName', 'bankAccountName', 'bankAccountNumber', 'notesAr', 'notesEn'] as const;

function paymentValues(payment: PaymentInstructions) {
  return Object.fromEntries(PAYMENT_FIELDS.map(field => [field, payment[field] ?? ''])) as Record<(typeof PAYMENT_FIELDS)[number], string>;
}

function PaymentSettings({ payment }: { payment: PaymentInstructions }) {
  const { text } = useLanguage();
  const saved = useSaved();
  const [error, setError] = useState<unknown>(null);
  const values = paymentValues(payment);
  const { register, handleSubmit, reset, watch, setError: setFieldError, formState: { errors, isDirty, isSubmitting, dirtyFields } } = useForm({
    resolver: schemaResolver(updatePaymentSettingsSchema),
    defaultValues: values,
  });
  const current = watch();
  const filled = (value: unknown) => typeof value === 'string' && value.trim() !== '';
  const onSubmit = handleSubmit(async body => {
    setError(null);
    try {
      // Only what changed, so the audit log records exactly that.
      const changes = Object.fromEntries(Object.entries(body).filter(([field]) => dirtyFields[field as keyof typeof dirtyFields]));
      const settings = await adminApi.updatePaymentSettings(changes);
      reset(paymentValues(settings.payment));
      saved(settings, text('اتحفظت بيانات الدفع', 'Payment details saved'));
    } catch (caught) {
      if (!applyServerIssues(caught, setFieldError, PAYMENT_FIELDS)) setError(caught);
    }
  });
  return <form className="card card-padded form" onSubmit={onSubmit} noValidate aria-labelledby="payment-settings-title">
    <div className="card-header"><div>
      <h2 id="payment-settings-title">{text('بيانات الدفع', 'Payment details')}</h2>
      <p>{text('أصحاب المطاعم بيحوّلوا على البيانات دي من صفحة الاشتراك.', 'Owners transfer to these details from their subscription page.')}</p>
    </div></div>
    <Alert kind="info" live={false}>{text('سيب خانات أي طريقة فاضية عشان تختفي من عند أصحاب المطاعم. التحويل البنكي بيظهر لما اسم البنك ورقم الحساب يكونوا مكتوبين.',
      'Leave a method’s fields empty to hide it from owners. Bank transfer is offered once the bank name and account number are filled in.')}</Alert>
    {error !== null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
    <div className="method-settings">
      <MethodGroup icon={LightningIcon} title={text('إنستاباي', 'InstaPay')} shown={filled(current.instapayAddress)}>
        <Field label={text('عنوان إنستاباي', 'InstaPay address')} error={errors.instapayAddress} optional><input className="input" dir="ltr" placeholder="name@instapay" {...register('instapayAddress')} /></Field>
      </MethodGroup>
      <MethodGroup icon={DeviceMobileIcon} title={text('فودافون كاش', 'Vodafone Cash')} shown={filled(current.vodafoneCashNumber)}>
        <Field label={text('رقم المحفظة', 'Wallet number')} error={errors.vodafoneCashNumber} optional><input className="input" type="tel" inputMode="tel" dir="ltr" placeholder="010xxxxxxxx" {...register('vodafoneCashNumber')} /></Field>
      </MethodGroup>
      <MethodGroup icon={BankIcon} title={text('تحويل بنكي', 'Bank transfer')} shown={filled(current.bankName) && filled(current.bankAccountNumber)} wide>
        <div className="form-grid form-grid-3">
          <Field label={text('اسم البنك', 'Bank name')} error={errors.bankName} optional><input className="input" {...register('bankName')} /></Field>
          <Field label={text('اسم صاحب الحساب', 'Account name')} error={errors.bankAccountName} optional><input className="input" {...register('bankAccountName')} /></Field>
          <Field label={text('رقم الحساب / IBAN', 'Account number / IBAN')} error={errors.bankAccountNumber} optional><input className="input" dir="ltr" {...register('bankAccountNumber')} /></Field>
        </div>
      </MethodGroup>
    </div>
    <div className="form-grid">
      <Field label={text('ملاحظات بالعربي', 'Notes in Arabic')} error={errors.notesAr} optional hint={text('بتظهر تحت بيانات التحويل.', 'Shown under the transfer details.')}>
        <textarea className="textarea" rows={3} maxLength={500} lang="ar" dir="rtl" {...register('notesAr')} />
      </Field>
      <Field label={text('ملاحظات بالإنجليزي', 'Notes in English')} error={errors.notesEn} optional>
        <textarea className="textarea" rows={3} maxLength={500} lang="en" dir="ltr" {...register('notesEn')} />
      </Field>
    </div>
    <div className="form-actions form-actions-end">
      <Button variant="secondary" disabled={!isDirty || isSubmitting} onClick={() => reset(values)}>{text('تراجع', 'Discard')}</Button>
      <Button type="submit" loading={isSubmitting} disabled={!isDirty}>{text('احفظ بيانات الدفع', 'Save payment details')}</Button>
    </div>
  </form>;
}

function MethodGroup({ icon: MethodIcon, title, shown, wide, children }: { icon: Icon; title: string; shown: boolean; wide?: boolean; children: ReactNode }) {
  const { text } = useLanguage();
  return <fieldset className={`method-group ${wide ? 'method-group-wide' : ''}`}>
    <legend className="method-group-head">
      <span className="method-icon" aria-hidden="true"><MethodIcon size={20} /></span>
      <strong>{title}</strong>
      <span className={`badge ${shown ? 'badge-success' : 'badge-muted'}`}>{shown ? text('ظاهرة للمطاعم', 'Shown to owners') : text('مخفية', 'Hidden')}</span>
    </legend>
    {children}
  </fieldset>;
}

function TrialSettings({ settings }: { settings: AdminSettings }) {
  const { text } = useLanguage();
  const saved = useSaved();
  const [enabled, setEnabled] = useState(settings.trial.enabled);
  const [days, setDays] = useState(String(settings.trial.durationDays));
  const [plan, setPlan] = useState<PlanCode>(settings.trial.planCode);
  const parsedDays = Number(days);
  const daysValid = Number.isInteger(parsedDays) && parsedDays >= 1 && parsedDays <= 365;
  const dirty = enabled !== settings.trial.enabled || parsedDays !== settings.trial.durationDays || plan !== settings.trial.planCode;
  const save = useMutation({
    mutationFn: () => adminApi.updateTrialSettings({ enabled, durationDays: parsedDays, planCode: plan }),
    onSuccess: result => saved(result, text('اتحفظت إعدادات التجربة', 'Trial settings saved')),
  });
  return <form className="card card-padded form" aria-labelledby="trial-title" noValidate onSubmit={event => { event.preventDefault(); if (daysValid) save.mutate(); }}>
    <div className="card-header"><div>
      <h2 id="trial-title">{text('التجربة المجانية', 'Free trial')}</h2>
      <p>{text('بتتطبق على المطاعم الجديدة بس؛ التجارب الشغالة مش بتتغير.', 'Applies to new restaurants only; running trials are not changed.')}</p>
    </div></div>
    {save.isError && <Alert kind="error">{errorMessage(save.error, text)}</Alert>}
    <Switch checked={enabled} onChange={setEnabled} label={text('تجربة مجانية للمطاعم الجديدة', 'Free trial for new restaurants')}
      description={enabled ? undefined : text('المطاعم الجديدة هتبدأ من غير اشتراك لحد ما تدفع.', 'New restaurants start without access until they pay.')} />
    <div className="form-grid">
      <Field label={text('مدة التجربة (أيام)', 'Trial length (days)')} required error={daysValid ? undefined : { message: text('من ١ لـ ٣٦٥ يوم.', '1 to 365 days.') }}>
        <input className="input" type="number" inputMode="numeric" min={1} max={365} dir="ltr" value={days} onChange={event => setDays(event.target.value)} disabled={!enabled} />
      </Field>
      <Field label={text('باقة التجربة', 'Trial plan')} required>
        <select className="select" value={plan} onChange={event => setPlan(event.target.value as PlanCode)} disabled={!enabled}>
          {settings.plans.map(entry => <option key={entry.code} value={entry.code}>{planName(entry.code, text)}</option>)}
        </select>
      </Field>
    </div>
    <div className="form-actions form-actions-end">
      <Button type="submit" loading={save.isPending} disabled={!dirty || !daysValid}>{text('احفظ إعدادات التجربة', 'Save trial settings')}</Button>
    </div>
  </form>;
}

function PlanPrices({ plans }: { plans: AdminSettings['plans'] }) {
  const { text } = useLanguage();
  return <section className="card card-padded" aria-labelledby="prices-title">
    <div className="card-header"><div>
      <h2 id="prices-title">{text('أسعار الباقات', 'Plan prices')}</h2>
      <p>{text('بالجنيه في الشهر. التحويلات اللي مستنية المراجعة والمدد المدفوعة بتفضل بسعرها القديم.', 'EGP per month. Payments waiting for review and paid periods keep their amount.')}</p>
    </div></div>
    <ul className="price-list">{plans.map(plan => <PlanPriceRow key={plan.code} code={plan.code} price={plan.priceMonthlyPiastres} />)}</ul>
  </section>;
}

function PlanPriceRow({ code, price }: { code: PlanCode; price: number }) {
  const { text, language } = useLanguage();
  const saved = useSaved();
  const [value, setValue] = useState(piastresToInput(price));
  const piastres = egpToPiastres(value);
  const invalid = piastres === null || piastres > 10_000_000;
  const save = useMutation({
    mutationFn: () => adminApi.updatePlanPrice(code, piastres!),
    onSuccess: result => {
      const updated = result.plans.find(plan => plan.code === code);
      if (updated) setValue(piastresToInput(updated.priceMonthlyPiastres));
      saved(result, text(`سعر ${planName(code, text)} بقى ${formatPrice(updated?.priceMonthlyPiastres ?? piastres!, language)}`, `${planName(code, text)} now costs ${formatPrice(updated?.priceMonthlyPiastres ?? piastres!, language)}`));
    },
  });
  const inputId = `price-${code}`;
  return <li className="price-row" data-testid={`plan-price-${code}`}>
    <label htmlFor={inputId}><strong>{planName(code, text)}</strong><small>{text('الحالي:', 'Current:')} {formatPrice(price, language)}</small></label>
    <form className="price-form" noValidate onSubmit={event => { event.preventDefault(); if (!invalid) save.mutate(); }}>
      <div className="input-group price-input">
        <input id={inputId} className="input" inputMode="decimal" dir="ltr" value={value} onChange={event => setValue(event.target.value)} aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${inputId}-error` : undefined} />
        <span className="input-affix">{text('ج.م', 'EGP')}</span>
      </div>
      <Button type="submit" small variant="secondary" loading={save.isPending} disabled={invalid || piastres === price}>{text('احفظ', 'Save')}</Button>
    </form>
    {invalid && <p className="field-error" id={`${inputId}-error`}>{text('اكتب السعر بالجنيه، لحد ١٠٠٬٠٠٠.', 'Enter a price in EGP, up to 100,000.')}</p>}
    {save.isError && <p className="field-error" role="alert">{errorMessage(save.error, text)}</p>}
  </li>;
}

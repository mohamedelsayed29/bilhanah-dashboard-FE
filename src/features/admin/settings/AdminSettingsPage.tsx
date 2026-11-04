import { useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BankIcon, DeviceMobileIcon, EyeIcon, GiftIcon, LightningIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { type AdminSettings, type PaymentInstructions, type PlanCode, updatePaymentSettingsSchema } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Field } from '../../../components/Field';
import { Section } from '../../../components/Section';
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
import { methodsShown, type PaymentMethod } from './payment-methods';

/** The settings the layout already loaded (it shows a skeleton until then). */
function useSettings(): AdminSettings | null {
  return useAdminSettingsQuery().data ?? null;
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

/** The side panel of a settings section: a heading and a few lines about it. */
export function SettingsAside({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <aside className="settings-aside" aria-labelledby={id}>
    <h2 id={id}>{title}</h2>
    {children}
  </aside>;
}

// --- Payment details ----------------------------------------------------------------------------

const PAYMENT_FIELDS = ['instapayAddress', 'vodafoneCashNumber', 'bankName', 'bankAccountName', 'bankAccountNumber', 'notesAr', 'notesEn'] as const;

function paymentValues(payment: PaymentInstructions) {
  return Object.fromEntries(PAYMENT_FIELDS.map(field => [field, payment[field] ?? ''])) as Record<(typeof PAYMENT_FIELDS)[number], string>;
}

/** /admin/settings: where owners transfer their subscription, with a live preview of what they see. */
export function PaymentSettingsPage() {
  const { text } = useLanguage();
  usePageTitle('بيانات الدفع', 'Payment details');
  const settings = useSettings();
  if (!settings) return <PageSkeleton blocks={2} />;
  return <PaymentSettings key={JSON.stringify(settings.payment)} payment={settings.payment} title={text('بيانات الدفع', 'Payment details')} />;
}

function PaymentSettings({ payment, title }: { payment: PaymentInstructions; title: string }) {
  const { text } = useLanguage();
  const saved = useSaved();
  const [error, setError] = useState<unknown>(null);
  const values = paymentValues(payment);
  const { register, handleSubmit, reset, watch, setError: setFieldError, formState: { errors, isDirty, isSubmitting, dirtyFields } } = useForm({
    resolver: schemaResolver(updatePaymentSettingsSchema),
    defaultValues: values,
  });
  const current = watch();
  const shown = methodsShown(current);
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
  return <div className="settings-grid">
    <form className="settings-main form" onSubmit={onSubmit} noValidate>
      <Section id="payment-settings-title" title={title}
        description={text('أصحاب المطاعم بيحوّلوا على البيانات دي من صفحة الاشتراك. سيب خانات أي طريقة فاضية عشان تختفي.', 'Owners transfer to these details from their subscription page. Leave a method’s fields empty to hide it.')}>
        {error !== null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
        <div className="method-settings">
          <MethodGroup icon={LightningIcon} title={text('إنستاباي', 'InstaPay')} shown={shown.includes('instapay')}>
            <Field label={text('عنوان إنستاباي', 'InstaPay address')} error={errors.instapayAddress} optional><input className="input" dir="ltr" placeholder="name@instapay" {...register('instapayAddress')} /></Field>
          </MethodGroup>
          <MethodGroup icon={DeviceMobileIcon} title={text('فودافون كاش', 'Vodafone Cash')} shown={shown.includes('vodafone')}>
            <Field label={text('رقم المحفظة', 'Wallet number')} error={errors.vodafoneCashNumber} optional><input className="input" type="tel" inputMode="tel" dir="ltr" placeholder="010xxxxxxxx" {...register('vodafoneCashNumber')} /></Field>
          </MethodGroup>
          <MethodGroup icon={BankIcon} title={text('تحويل بنكي', 'Bank transfer')} shown={shown.includes('bank')} wide
            hint={text('بيظهر لما اسم البنك ورقم الحساب يكونوا مكتوبين.', 'Offered once the bank name and account number are filled in.')}>
            <div className="form-grid form-grid-3">
              <Field label={text('اسم البنك', 'Bank name')} error={errors.bankName} optional><input className="input" {...register('bankName')} /></Field>
              <Field label={text('اسم صاحب الحساب', 'Account name')} error={errors.bankAccountName} optional><input className="input" {...register('bankAccountName')} /></Field>
              <Field label={text('رقم الحساب / IBAN', 'Account number / IBAN')} error={errors.bankAccountNumber} optional><input className="input" dir="ltr" {...register('bankAccountNumber')} /></Field>
            </div>
          </MethodGroup>
        </div>
      </Section>
      <Section id="payment-notes-title" title={text('ملاحظات للمطاعم', 'Notes for owners')} description={text('بتظهر تحت بيانات التحويل، زي «اكتب اسم مطعمك في الرسالة».', 'Shown under the transfer details, e.g. “Add your restaurant’s name to the transfer note”.')}>
        <div className="form-grid">
          <Field label={text('بالعربي', 'In Arabic')} error={errors.notesAr} optional>
            <textarea className="textarea" rows={3} maxLength={500} lang="ar" dir="rtl" {...register('notesAr')} />
          </Field>
          <Field label={text('بالإنجليزي', 'In English')} error={errors.notesEn} optional>
            <textarea className="textarea" rows={3} maxLength={500} lang="en" dir="ltr" {...register('notesEn')} />
          </Field>
        </div>
      </Section>
      <div className={`settings-savebar ${isDirty ? 'is-dirty' : ''}`} role="group" aria-label={text('الحفظ', 'Save')}>
        <span className="settings-savebar-note" aria-live="polite">{isDirty ? text('في تغييرات لسه ما اتحفظتش', 'You have unsaved changes') : text('كل التغييرات محفوظة', 'All changes saved')}</span>
        <Button variant="secondary" disabled={!isDirty || isSubmitting} onClick={() => reset(values)}>{text('تراجع', 'Discard')}</Button>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>{text('احفظ بيانات الدفع', 'Save payment details')}</Button>
      </div>
    </form>
    <SettingsAside id="payment-preview-title" title={text('اللي بيشوفه صاحب المطعم', 'What owners see')}>
      <p className="field-hint">{text('معاينة حيّة لصفحة الاشتراك عند المطاعم، بتتغير وانت بتكتب.', 'A live preview of the owners’ subscription page, updating as you type.')}</p>
      <PaymentPreview values={current} shown={shown} />
    </SettingsAside>
  </div>;
}

function MethodGroup({ icon: MethodIcon, title, shown, wide, hint, children }: { icon: Icon; title: string; shown: boolean; wide?: boolean; hint?: string; children: ReactNode }) {
  const { text } = useLanguage();
  return <fieldset className={`method-group ${wide ? 'method-group-wide' : ''} ${shown ? 'is-shown' : ''}`}>
    <legend className="method-group-head">
      <span className="method-icon" aria-hidden="true"><MethodIcon size={20} /></span>
      <strong>{title}</strong>
      <span className={`badge ${shown ? 'badge-success' : 'badge-muted'}`}>{shown ? text('ظاهرة للمطاعم', 'Shown to owners') : text('مخفية', 'Hidden')}</span>
    </legend>
    {children}
    {hint && <p className="field-hint">{hint}</p>}
  </fieldset>;
}

const METHOD_TEXT: Record<PaymentMethod, { icon: Icon; ar: string; en: string }> = {
  instapay: { icon: LightningIcon, ar: 'إنستاباي', en: 'InstaPay' },
  vodafone: { icon: DeviceMobileIcon, ar: 'فودافون كاش', en: 'Vodafone Cash' },
  bank: { icon: BankIcon, ar: 'تحويل بنكي', en: 'Bank transfer' },
};

/** The transfer box an owner sees, from the form as it stands. */
function PaymentPreview({ values: raw, shown }: { values: Partial<Record<(typeof PAYMENT_FIELDS)[number], string | null>>; shown: PaymentMethod[] }) {
  const { text, language } = useLanguage();
  const values = paymentValues(raw as PaymentInstructions);
  const notes = (language === 'en' ? values.notesEn || values.notesAr : values.notesAr || values.notesEn).trim();
  if (!shown.length) {
    return <div className="payment-preview is-empty" data-testid="payment-preview">
      <EyeIcon size={22} aria-hidden="true" />
      <p>{text('مفيش طريقة دفع ظاهرة، فأصحاب المطاعم مش هيقدروا يحوّلوا. اكتب بيانات طريقة واحدة على الأقل.', 'No method is shown, so owners cannot transfer. Fill in at least one method.')}</p>
    </div>;
  }
  return <div className="payment-preview" data-testid="payment-preview">
    <ul>
      {shown.map(method => {
        const { icon: MethodIcon, ar, en } = METHOD_TEXT[method];
        const detail = method === 'instapay' ? values.instapayAddress : method === 'vodafone' ? values.vodafoneCashNumber
          : [values.bankName, values.bankAccountName, values.bankAccountNumber].filter(part => part.trim()).join(' · ');
        return <li key={method}>
          <span className="method-icon" aria-hidden="true"><MethodIcon size={18} /></span>
          <span><strong>{text(ar, en)}</strong><bdi className="ltr">{detail}</bdi></span>
        </li>;
      })}
    </ul>
    {notes && <p className="payment-preview-notes"><bdi>{notes}</bdi></p>}
  </div>;
}

// --- Free trial ---------------------------------------------------------------------------------

/** /admin/settings/trial: what new restaurants get when they sign up. */
export function TrialSettingsPage() {
  usePageTitle('التجربة المجانية', 'Free trial');
  const settings = useSettings();
  if (!settings) return <PageSkeleton blocks={2} />;
  return <TrialSettings key={JSON.stringify(settings.trial)} settings={settings} />;
}

function TrialSettings({ settings }: { settings: AdminSettings }) {
  const { text, number } = useLanguage();
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
  const reset = () => { setEnabled(settings.trial.enabled); setDays(String(settings.trial.durationDays)); setPlan(settings.trial.planCode); };
  return <div className="settings-grid">
    <form className="settings-main form" aria-labelledby="trial-title" noValidate onSubmit={event => { event.preventDefault(); if (daysValid) save.mutate(); }}>
      <Section id="trial-title" title={text('التجربة المجانية', 'Free trial')}
        description={text('بتتطبق على المطاعم الجديدة بس؛ التجارب الشغالة مش بتتغير.', 'Applies to new restaurants only; running trials are not changed.')}>
        {save.isError && <Alert kind="error">{errorMessage(save.error, text)}</Alert>}
        <Switch checked={enabled} onChange={setEnabled} label={text('تجربة مجانية للمطاعم الجديدة', 'Free trial for new restaurants')}
          description={enabled ? text('المطعم بيبدأ شغال على طول من غير دفع.', 'A restaurant starts working right away, without paying.') : text('المطاعم الجديدة هتبدأ من غير اشتراك لحد ما تدفع.', 'New restaurants start without access until they pay.')} />
        <div className="form-grid">
          <Field label={text('مدة التجربة (أيام)', 'Trial length (days)')} required error={daysValid ? undefined : { message: text('من ١ لـ ٣٦٥ يوم.', '1 to 365 days.') }}>
            <input className="input" type="number" inputMode="numeric" min={1} max={365} dir="ltr" value={days} onChange={event => setDays(event.target.value)} disabled={!enabled} />
          </Field>
          <Field label={text('باقة التجربة', 'Trial plan')} required hint={text('المطعم بيجرّب مميزات الباقة دي.', 'The restaurant tries this plan’s features.')}>
            <select className="select" value={plan} onChange={event => setPlan(event.target.value as PlanCode)} disabled={!enabled}>
              {settings.plans.map(entry => <option key={entry.code} value={entry.code}>{planName(entry.code, text)}</option>)}
            </select>
          </Field>
        </div>
      </Section>
      <div className={`settings-savebar ${dirty ? 'is-dirty' : ''}`} role="group" aria-label={text('الحفظ', 'Save')}>
        <span className="settings-savebar-note" aria-live="polite">{dirty ? text('في تغييرات لسه ما اتحفظتش', 'You have unsaved changes') : text('كل التغييرات محفوظة', 'All changes saved')}</span>
        <Button variant="secondary" disabled={!dirty || save.isPending} onClick={reset}>{text('تراجع', 'Discard')}</Button>
        <Button type="submit" loading={save.isPending} disabled={!dirty || !daysValid}>{text('احفظ إعدادات التجربة', 'Save trial settings')}</Button>
      </div>
    </form>
    <SettingsAside id="trial-summary-title" title={text('المطعم الجديد هياخد', 'A new restaurant gets')}>
      <div className="trial-summary" data-testid="trial-summary">
        <span className="trial-summary-icon" aria-hidden="true"><GiftIcon size={22} weight="duotone" /></span>
        {enabled && daysValid
          ? <p><strong>{text(`${number(parsedDays)} يوم مجانًا`, `${parsedDays} days free`)}</strong>{text(` على باقة ${planName(plan, text)}`, ` on ${planName(plan, text)}`)}</p>
          : <p><strong>{text('من غير تجربة', 'No trial')}</strong>{text('، لازم يدفع عشان يبدأ', '; they pay to start')}</p>}
      </div>
      <p className="field-hint">{text('صاحب المطعم بيوصله تذكير بالإيميل قبل ما التجربة تخلص بـ ٧ و٣ ويوم واحد.', 'Owners are emailed a reminder 7, 3 and 1 days before the trial ends.')}</p>
    </SettingsAside>
  </div>;
}

// --- Plan prices --------------------------------------------------------------------------------

/** /admin/settings/plans: monthly prices; payments under review and paid periods keep theirs. */
export function PlanPricesPage() {
  const { text } = useLanguage();
  usePageTitle('أسعار الباقات', 'Plan prices');
  const settings = useSettings();
  if (!settings) return <PageSkeleton blocks={2} />;
  return <div className="settings-grid">
    <div className="settings-main">
      <Section id="prices-title" title={text('أسعار الباقات', 'Plan prices')}
        description={text('بالجنيه في الشهر. كل باقة بتتحفظ لوحدها.', 'EGP per month. Each plan saves on its own.')}>
        <ul className="plan-price-cards">{settings.plans.map(plan => <PlanPriceRow key={`${plan.code}-${plan.priceMonthlyPiastres}`} code={plan.code} price={plan.priceMonthlyPiastres} />)}</ul>
      </Section>
    </div>
    <SettingsAside id="prices-note-title" title={text('قبل ما تغيّر سعر', 'Before changing a price')}>
      <p className="field-hint">{text('السعر الجديد بيظهر على الموقع وفي صفحة الاشتراك على طول. التحويلات اللي مستنية المراجعة والمدد المدفوعة بتفضل بسعرها القديم.',
        'The new price shows on the website and the subscription page at once. Payments waiting for review and paid periods keep their amount.')}</p>
    </SettingsAside>
  </div>;
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
  const changed = !invalid && piastres !== price;
  return <li className={`plan-price-card ${changed ? 'is-changed' : ''}`} data-testid={`plan-price-${code}`}>
    <div className="plan-price-head">
      <label htmlFor={inputId}><strong>{planName(code, text)}</strong></label>
      <small>{text('الحالي:', 'Current:')} {formatPrice(price, language)}</small>
    </div>
    <form className="price-form" noValidate onSubmit={event => { event.preventDefault(); if (!invalid) save.mutate(); }}>
      <div className="input-group price-input">
        <input id={inputId} className="input" inputMode="decimal" dir="ltr" value={value} onChange={event => setValue(event.target.value)} aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${inputId}-error` : undefined} />
        <span className="input-affix">{text('ج.م / شهر', 'EGP / mo')}</span>
      </div>
      <Button type="submit" small variant={changed ? 'primary' : 'secondary'} loading={save.isPending} disabled={!changed}>{text('احفظ', 'Save')}</Button>
    </form>
    {invalid && <p className="field-error" id={`${inputId}-error`}>{text('اكتب السعر بالجنيه، لحد ١٠٠٬٠٠٠.', 'Enter a price in EGP, up to 100,000.')}</p>}
    {save.isError && <p className="field-error" role="alert">{errorMessage(save.error, text)}</p>}
  </li>;
}

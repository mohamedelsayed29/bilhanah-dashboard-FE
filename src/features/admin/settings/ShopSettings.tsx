import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ShopSettings } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { Field } from '../../../components/Field';
import { Skeleton } from '../../../components/Skeleton';
import { Switch } from '../../../components/Switch';
import { useToast } from '../../../components/Toast';
import { adminApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { Section } from '../../../components/Section';
import { SettingsAside } from './AdminSettingsPage';
import { adminKeys, useShopSettingsQuery } from '../queries';
import { fromShopForm, onlineHidden, toShopForm, type ShopForm, type ShopProblem } from './shop-settings';

/** /admin/settings/shop: what the stand shop's checkout offers, the delivery fee and the ways to pay. */
export function ShopSettingsPage() {
  const { text } = useLanguage();
  usePageTitle('متجر الستاندات', 'Stand shop');
  const settings = useShopSettingsQuery();
  return <div className="settings-grid">
    <div className="settings-main">
      <Section id="shop-settings-title" title={text('متجر الستاندات', 'Stand shop')} data-testid="shop-settings"
        description={text('رسوم التوصيل وطرق الدفع اللي بتظهر في صفحة طلب الستاندات على الموقع.', 'The delivery fee and ways to pay offered at the website’s stand checkout.')}>
        {settings.isPending && <div className="skeleton-stack" role="status" aria-label={text('جاري التحميل', 'Loading')}><Skeleton height={46} /><Skeleton height={44} /><Skeleton height={44} /></div>}
        {settings.isError && <ErrorPanel error={settings.error} onRetry={() => void settings.refetch()} />}
        {settings.data && <ShopSettingsForm key={JSON.stringify(settings.data)} settings={settings.data} />}
      </Section>
    </div>
    <SettingsAside id="shop-note-title" title={text('الدفع الأونلاين', 'Online payment')}>
      <p className="field-hint">{text('الدفع الأونلاين محتاج Paymob يكون متظبط على السيرفر ورسوم توصيل ثابتة. لو Paymob مش متظبط، الدفع الأونلاين مش هيظهر للعملاء.',
        'Online payment needs Paymob configured on the server and a fixed delivery fee. Without Paymob, customers are not offered online payment.')}</p>
    </SettingsAside>
  </div>;
}

function ShopSettingsForm({ settings }: { settings: ShopSettings }) {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const initial = toShopForm(settings);
  const [form, setForm] = useState<ShopForm>(initial);
  const [submitted, setSubmitted] = useState(false);
  const result = fromShopForm(form);
  const problem: ShopProblem | null = 'problem' in result ? result.problem : null;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (changes: Partial<ShopForm>) => setForm(current => ({ ...current, ...changes }));
  const save = useMutation({
    mutationFn: (body: ShopSettings) => adminApi.updateShopSettings(body),
    onSuccess: saved => {
      queryClient.setQueryData(adminKeys.shopSettings, saved);
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
      toast.success(text('اتحفظت إعدادات المتجر', 'Shop settings saved'));
    },
  });
  const onSubmit = () => {
    setSubmitted(true);
    if ('settings' in result) save.mutate(result.settings);
  };
  const feeError = problem === 'fee' && (submitted || form.fee !== '') ? { message: text('اكتب الرسوم بالجنيه، من ٠ لـ ١٬٠٠٠.', 'Enter the fee in EGP, from 0 to 1,000.') } : undefined;
  const payError = problem === 'none' ? text('لازم طريقة دفع واحدة على الأقل تكون شغالة.', 'Turn on at least one way to pay.')
    : problem === 'online-needs-fee' ? text('والتوصيل بيتأكد بالتليفون الدفع الأونلاين مش بيظهر، فشغّل الكاش عند الاستلام أو حدد رسوم ثابتة.', 'While delivery is confirmed by phone, online payment is hidden, so turn on cash on delivery or set a fixed fee.')
      : null;
  return <form className="form" noValidate onSubmit={event => { event.preventDefault(); onSubmit(); }}>
    {save.isError && <Alert kind="error">{errorMessage(save.error, text)}</Alert>}
    <fieldset className="field">
      <legend className="field-label">{text('رسوم التوصيل', 'Delivery fee')}</legend>
      <div className="segmented fee-mode">
        <label><input type="radio" name="fee-mode" value="fixed" checked={form.feeMode === 'fixed'} onChange={() => set({ feeMode: 'fixed' })} />{text('مبلغ ثابت', 'Fixed fee')}</label>
        <label><input type="radio" name="fee-mode" value="phone" checked={form.feeMode === 'phone'} onChange={() => set({ feeMode: 'phone' })} />{text('يتأكد بالتليفون', 'Confirmed by phone')}</label>
      </div>
    </fieldset>
    {form.feeMode === 'fixed'
      ? <Field label={text('الرسوم لكل طلب', 'Fee per order')} required error={feeError} hint={text('نفس الرسوم لكل المحافظات. اكتب ٠ لو التوصيل مجاني.', 'The same fee everywhere. Enter 0 for free delivery.')}>
          {control => <div className="input-group price-input fee-input">
            <input {...control} className="input" inputMode="decimal" dir="ltr" value={form.fee} onChange={event => set({ fee: event.target.value })} data-testid="delivery-fee" />
            <span className="input-affix">{text('ج.م', 'EGP')}</span>
          </div>}
        </Field>
      : <p className="field-hint">{text('الموقع هيكتب إن رسوم التوصيل بتتأكد في التليفون، والإجمالي هيبان من غيرها.', 'The website says the fee is confirmed by phone and shows totals without it.')}</p>}
    <div className="switch-list">
      <Switch checked={form.cashOnDelivery} onChange={value => set({ cashOnDelivery: value })} label={text('كاش عند الاستلام', 'Cash on delivery')}
        description={text('العميل بيدفع للمندوب، وانت بتسجّل التحصيل من صفحة الطلب.', 'The customer pays the courier; record the cash from the order page.')} />
      <Switch checked={form.onlinePayment} onChange={value => set({ onlinePayment: value })} label={text('دفع أونلاين (كارت أو محفظة)', 'Online payment (card or wallet)')}
        description={text('عن طريق Paymob، والطلب بيوصل «جديد» بعد الدفع.', 'Through Paymob; the order arrives as “New” once paid.')} />
    </div>
    {payError && (submitted || problem === 'online-needs-fee') && <p className="field-error" role="alert" data-testid="shop-pay-error">{payError}</p>}
    {onlineHidden(form) && problem !== 'online-needs-fee' && <Alert kind="warning" live={false}>{text('والتوصيل بيتأكد بالتليفون، الدفع الأونلاين مش هيظهر على الموقع.', 'While delivery is confirmed by phone, online payment is not shown on the website.')}</Alert>}
    <div className="form-actions form-actions-end">
      <Button variant="secondary" disabled={!dirty || save.isPending} onClick={() => { setForm(initial); setSubmitted(false); }}>{text('تراجع', 'Discard')}</Button>
      <Button type="submit" loading={save.isPending} disabled={!dirty}>{text('احفظ إعدادات المتجر', 'Save shop settings')}</Button>
    </div>
  </form>;
}

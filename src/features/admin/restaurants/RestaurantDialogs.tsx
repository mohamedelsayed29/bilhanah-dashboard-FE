import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarCheckIcon } from '@phosphor-icons/react';
import {
  ADMIN_ERROR_CODES, type AdminRestaurantDetail, grantEntitlementSchema, PLAN_CODES, suspendRestaurantSchema,
} from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Dialog } from '../../../components/Dialog';
import { Field } from '../../../components/Field';
import { useToast } from '../../../components/Toast';
import { isApiError } from '../../../lib/api';
import { adminApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { formatDate } from '../../../lib/format';
import { schemaResolver } from '../../../lib/forms';
import { useLanguage } from '../../../lib/language';
import { monthsLabel, planName } from '../../billing/labels';
import { nextPeriodStart, periodFrom } from '../../billing/period';
import { invalidateAfterChange } from '../queries';

type Props = { open: boolean; restaurant: AdminRestaurantDetail; onClose: () => void };

export function SuspendDialog(props: Props) {
  return props.open ? <SuspendForm {...props} /> : null;
}

function SuspendForm({ restaurant, onClose }: Props) {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ resolver: schemaResolver(suspendRestaurantSchema), defaultValues: { reason: '' } });
  const length = watch('reason').trim().length;
  const onSubmit = handleSubmit(async ({ reason }) => {
    setError(null);
    try {
      await adminApi.suspend(restaurant.id, reason);
      toast.success(text('اتوقف المطعم.', 'Restaurant suspended.'));
    } catch (caught) {
      if (!isApiError(caught, ADMIN_ERROR_CODES.ALREADY_SUSPENDED)) { setError(caught); return; }
      toast.error(errorMessage(caught, text));
    }
    await invalidateAfterChange(queryClient, restaurant.id);
    onClose();
  });
  return <Dialog open onClose={onClose} busy={isSubmitting} size="small" title={text(`توقف ${restaurant.name}؟`, `Suspend ${restaurant.name}?`)} onSubmit={() => void onSubmit()}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>{text('إلغاء', 'Cancel')}</Button>
      <Button type="submit" variant="danger" loading={isSubmitting}>{text('أوقف المطعم', 'Suspend restaurant')}</Button>
    </>}>
    <div className="form">
      {error !== null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
      <ul className="tips">
        <li>{text('المنيو العام هيقفل فورًا، والزباين هيشوفوا إنه "مش متاح مؤقتًا".', 'The public menu goes offline at once; diners see it as “temporarily unavailable”.')}</li>
        <li>{text('صاحب المطعم مش هيقدر يعدّل أو يدفع لحد ما ترجّعه. البيانات والاشتراك محفوظين.', 'The owner cannot edit or pay until you unsuspend it. Data and periods are kept.')}</li>
      </ul>
      <Field label={text('السبب', 'Reason')} error={errors.reason} required hint={text(`بيتسجل في سجل المراجعة · ${length}/300`, `Recorded in the audit log · ${length}/300`)}>
        <textarea className="textarea" rows={3} maxLength={300} data-autofocus {...register('reason')} />
      </Field>
    </div>
  </Dialog>;
}

export function GrantDialog(props: Props) {
  return props.open ? <GrantForm {...props} /> : null;
}

function GrantForm({ restaurant, onClose }: Props) {
  const { text, number, language } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: schemaResolver(grantEntitlementSchema),
    defaultValues: { planCode: restaurant.access.planCode ?? 'MENU', months: 1, note: '' },
  });
  const months = Number(watch('months'));
  const validMonths = Number.isInteger(months) && months >= 1 && months <= 24;
  const preview = validMonths ? periodFrom(nextPeriodStart(restaurant.entitlements), months) : null;
  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      const period = await adminApi.grant(restaurant.id, values);
      toast.success(text(`اتضافت المدة لحد ${formatDate(period.endsAt, language, { dateStyle: 'long' })}.`, `Period granted until ${formatDate(period.endsAt, language, { dateStyle: 'long' })}.`));
      await invalidateAfterChange(queryClient, restaurant.id);
      onClose();
    } catch (caught) {
      setError(caught);
    }
  });
  return <Dialog open onClose={onClose} busy={isSubmitting} title={text('إضافة مدة مدفوعة', 'Grant a paid period')} onSubmit={() => void onSubmit()}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>{text('إلغاء', 'Cancel')}</Button>
      <Button type="submit" loading={isSubmitting}>{text('أضف المدة', 'Grant period')}</Button>
    </>}>
    <div className="form">
      {error !== null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
      <p className="muted">{text('للدفع الكاش أو التصحيحات أو الهدايا. المدة بتبدأ بعد آخر فترة شغالة.', 'For cash payments, corrections or goodwill. The period starts after the latest running one.')}</p>
      <div className="form-grid">
        <Field label={text('الباقة', 'Plan')} error={errors.planCode} required>
          <select className="select" data-autofocus {...register('planCode')}>
            {PLAN_CODES.map(code => <option key={code} value={code}>{planName(code, text)}</option>)}
          </select>
        </Field>
        <Field label={text('عدد الشهور', 'Months')} error={errors.months} required hint={text('من ١ لـ ٢٤', '1 to 24')}>
          <input className="input" type="number" inputMode="numeric" min={1} max={24} step={1} dir="ltr" {...register('months', { valueAsNumber: true })} />
        </Field>
      </div>
      <Field label={text('ملاحظة', 'Note')} error={errors.note} required hint={text('ليه اتضافت المدة؟ بتظهر في الفترات وسجل المراجعة.', 'Why is it granted? Shown on the period and in the audit log.')}>
        <textarea className="textarea" rows={3} maxLength={300} placeholder={text('مثلًا: دفع كاش في المكتب', 'e.g. Paid in cash at the office')} {...register('note')} />
      </Field>
      {preview && <div className="order-period" aria-live="polite">
        <CalendarCheckIcon size={22} aria-hidden="true" />
        <p>{text(`${monthsLabel(months, text, number)} من`, `${monthsLabel(months, text, number)} from`)} <strong>{formatDate(preview.startsAt.toISOString(), language, { dateStyle: 'long' })}</strong> {text('لحد', 'to')} <strong>{formatDate(preview.endsAt.toISOString(), language, { dateStyle: 'long' })}</strong>.</p>
      </div>}
    </div>
  </Dialog>;
}

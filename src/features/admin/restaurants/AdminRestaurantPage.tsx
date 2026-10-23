import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightIcon, ArrowSquareOutIcon, CalendarPlusIcon, PauseCircleIcon, PlayCircleIcon, ReceiptIcon,
} from '@phosphor-icons/react';
import type { AdminEntitlement, AdminRestaurantDetail } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { PageSkeleton } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import { adminApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { formatDate, formatPrice } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { methodName, monthsLabel, PaymentStatusBadge, planName } from '../../billing/labels';
import { AccessBadge } from '../../restaurant/access';
import { PaymentDialog } from '../payments/PaymentDialog';
import { invalidateAfterChange, useAdminRestaurantQuery } from '../queries';
import { GrantDialog, SuspendDialog } from './RestaurantDialogs';

export function AdminRestaurantPage() {
  const { text } = useLanguage();
  const { restaurantId = '' } = useParams();
  const restaurant = useAdminRestaurantQuery(restaurantId);
  usePageTitle(restaurant.data?.name ?? 'مطعم', restaurant.data?.name ?? 'Restaurant');
  if (restaurant.isPending) return <PageSkeleton blocks={3} />;
  if (restaurant.isError) {
    return <div className="page">
      <BackLink />
      <ErrorPanel error={restaurant.error} onRetry={() => void restaurant.refetch()} />
    </div>;
  }
  return <RestaurantDetail restaurant={restaurant.data} />;
}

function BackLink() {
  const { text } = useLanguage();
  return <Link to="/admin/restaurants" className="back-link"><ArrowRightIcon size={16} className="directional" aria-hidden="true" />{text('كل المطاعم', 'All restaurants')}</Link>;
}

function RestaurantDetail({ restaurant }: { restaurant: AdminRestaurantDetail }) {
  const { text, number, language } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<'suspend' | 'unsuspend' | 'grant' | null>(null);
  const [payment, setPayment] = useState<string | null>(null);
  const suspended = restaurant.status === 'SUSPENDED';
  const unsuspend = useMutation({
    mutationFn: () => adminApi.unsuspend(restaurant.id),
    onSuccess: () => toast.success(text('رجّعنا المطعم. المنيو العام ظاهر تاني حسب اشتراكه.', 'Restaurant reinstated. Its public menu is back, subject to its plan.')),
    onError: error => toast.error(errorMessage(error, text)),
    onSettled: () => { setDialog(null); return invalidateAfterChange(queryClient, restaurant.id); },
  });
  const { access } = restaurant;
  const end = access.status === 'TRIAL' ? access.trialEndsAt : access.currentPeriodEndsAt;
  return <div className="page">
    <BackLink />
    <PageHeader title={<bdi>{restaurant.name}</bdi>}
      description={<a className="link ltr" href={restaurant.publicUrl} target="_blank" rel="noreferrer">{restaurant.publicUrl.replace(/^https?:\/\//, '')}<ArrowSquareOutIcon size={15} aria-hidden="true" className="inline-icon" /></a>}
      actions={<>
        {suspended
          ? <Button variant="secondary" icon={<PlayCircleIcon size={18} aria-hidden="true" />} onClick={() => setDialog('unsuspend')}>{text('رجّع المطعم', 'Unsuspend')}</Button>
          : <Button variant="danger-outline" icon={<PauseCircleIcon size={18} aria-hidden="true" />} onClick={() => setDialog('suspend')}>{text('أوقف المطعم', 'Suspend')}</Button>}
        <Button icon={<CalendarPlusIcon size={18} aria-hidden="true" />} onClick={() => setDialog('grant')}>{text('أضف مدة مدفوعة', 'Grant paid period')}</Button>
      </>} />
    {suspended && <Alert kind="error" live={false} title={text('المطعم موقوف', 'This restaurant is suspended')}>
      {text('المنيو العام مش ظاهر وصاحب المطعم مش قادر يعدّل. البيانات محفوظة. السبب موجود في سجل المراجعة.', 'Its public menu is offline and the owner cannot edit. Data is kept; the reason is in the audit log.')}
    </Alert>}

    <div className="detail-grid">
      <section className="section" aria-labelledby="info-title">
        <div className="section-head"><div><h2 id="info-title">{text('البيانات', 'Details')}</h2></div></div>
        <dl className="facts">
          <div><dt>{text('صاحب المطعم', 'Owner')}</dt><dd>{restaurant.ownerName}{restaurant.ownerStatus === 'SUSPENDED' && <> <span className="badge badge-danger">{text('الحساب موقوف', 'Account suspended')}</span></>}</dd></div>
          <div><dt>{text('الإيميل', 'Email')}</dt><dd><a className="link ltr" href={`mailto:${restaurant.ownerEmail}`}>{restaurant.ownerEmail}</a></dd></div>
          <div><dt>{text('الموبايل', 'Phone')}</dt><dd><a className="link ltr" href={`tel:${restaurant.phone}`}>{restaurant.phone}</a></dd></div>
          <div><dt>{text('واتساب', 'WhatsApp')}</dt><dd>{restaurant.whatsappNumber ? <span className="ltr">{restaurant.whatsappNumber}</span> : <span className="muted">—</span>}</dd></div>
          <div><dt>{text('المدينة', 'City')}</dt><dd>{restaurant.city}</dd></div>
          <div><dt>{text('العنوان', 'Address')}</dt><dd>{restaurant.address}</dd></div>
          <div><dt>{text('العنوان على بالهنا', 'Subdomain')}</dt><dd className="ltr">{restaurant.subdomain}</dd></div>
          <div><dt>{text('اتسجل يوم', 'Joined')}</dt><dd>{formatDate(restaurant.createdAt, language, { dateStyle: 'long' })}</dd></div>
        </dl>
      </section>
      <section className="section access-panel" aria-labelledby="access-title">
        <div className="section-head"><div><h2 id="access-title">{text('الاشتراك', 'Access')}</h2></div><AccessBadge access={access} /></div>
        <p className="access-plan">{access.planCode ? planName(access.planCode, text) : text('من غير باقة', 'No plan')}</p>
        {end && access.status !== 'INACTIVE' && <p className="muted">{access.status === 'TRIAL' ? text('التجربة بتنتهي', 'Trial ends') : text('ساري لحد', 'Active until')} <strong>{formatDate(end, language, { dateStyle: 'long' })}</strong></p>}
        <dl className="mini-stats">
          <div><dt>{text('الأقسام', 'Categories')}</dt><dd>{number(restaurant.menu.categories)}</dd></div>
          <div><dt>{text('الأصناف', 'Items')}</dt><dd>{number(restaurant.menu.items)}</dd></div>
          <div><dt>{text('التحويلات', 'Payments')}</dt><dd>{number(restaurant.payments.length)}</dd></div>
        </dl>
      </section>
    </div>

    <section className="section" aria-labelledby="periods-title">
      <div className="section-head"><div><h2 id="periods-title">{text('فترات الاشتراك', 'Entitlements')}</h2><p>{text('التجربة والمدد المدفوعة، الأحدث الأول.', 'Trial and paid periods, newest first.')}</p></div></div>
      {restaurant.entitlements.length === 0
        ? <p className="muted empty-line">{text('مفيش فترات على المطعم ده.', 'This restaurant has no periods.')}</p>
        : <ol className="timeline">{restaurant.entitlements.map(entitlement => <EntitlementItem key={entitlement.id} entitlement={entitlement} onOpenPayment={setPayment} />)}</ol>}
    </section>

    <section className="section" aria-labelledby="restaurant-payments-title">
      <div className="section-head"><div><h2 id="restaurant-payments-title">{text('التحويلات', 'Payments')}</h2><p>{text('آخر ٥٠ تحويل من المطعم ده.', 'The latest 50 payments from this restaurant.')}</p></div></div>
      {restaurant.payments.length === 0
        ? <p className="muted empty-line">{text('المطعم ده مبعتش تحويلات.', 'No payments from this restaurant yet.')}</p>
        : <ul className="history-list">{restaurant.payments.map(entry => <li key={entry.id} className="history-row" data-testid="restaurant-payment-row">
            <div className="history-main">
              <strong>{planName(entry.planCode, text)} · {monthsLabel(entry.months, text, number)}</strong>
              <small>{formatDate(entry.createdAt, language)} · {methodName(entry.method, text)} · <span className="ltr">{entry.reference}</span></small>
              {entry.rejectionReason && <p className="history-reason"><strong>{text('سبب الرفض:', 'Reason:')}</strong> {entry.rejectionReason}</p>}
            </div>
            <div className="history-side">
              <span className="history-amount">{formatPrice(entry.amountPiastres, language)}</span>
              <PaymentStatusBadge status={entry.status} method={entry.method} />
              <button type="button" className="text-button small" onClick={() => setPayment(entry.id)}><ReceiptIcon size={16} aria-hidden="true" />{text('التفاصيل', 'Details')}</button>
            </div>
          </li>)}</ul>}
    </section>

    <SuspendDialog open={dialog === 'suspend'} restaurant={restaurant} onClose={() => setDialog(null)} />
    <GrantDialog open={dialog === 'grant'} restaurant={restaurant} onClose={() => setDialog(null)} />
    <ConfirmDialog open={dialog === 'unsuspend'} tone="primary" busy={unsuspend.isPending} onCancel={() => setDialog(null)} onConfirm={() => unsuspend.mutate()}
      title={text('ترجّع المطعم؟', 'Unsuspend this restaurant?')} confirmLabel={text('رجّعه', 'Unsuspend')}
      description={text('المنيو العام هيرجع يظهر لو اشتراكه ساري، وصاحب المطعم هيقدر يعدّل تاني.', 'Its public menu comes back if its plan is active, and the owner can edit again.')} />
    <PaymentDialog paymentId={payment} onClose={() => setPayment(null)} />
  </div>;
}

function EntitlementItem({ entitlement, onOpenPayment }: { entitlement: AdminEntitlement; onOpenPayment: (id: string) => void }) {
  const { text, language } = useLanguage();
  const now = Date.now();
  const starts = new Date(entitlement.startsAt).getTime();
  const ends = new Date(entitlement.endsAt).getTime();
  const state = now < starts ? 'upcoming' : now < ends ? 'current' : 'past';
  return <li className={`timeline-item is-${state}`} data-testid="entitlement">
    <span className="timeline-dot" aria-hidden="true" />
    <div className="timeline-body">
      <div className="timeline-head">
        <strong>{planName(entitlement.planCode, text)}</strong>
        <span className="timeline-kind">{entitlement.kind === 'TRIAL' ? text('تجربة', 'Trial') : text('مدفوع', 'Paid')}</span>
        {state === 'current' && <span className="badge">{text('شغّالة دلوقتي', 'Current')}</span>}
        {state === 'upcoming' && <span className="badge badge-muted">{text('جاية', 'Upcoming')}</span>}
      </div>
      <p className="timeline-dates">{formatDate(entitlement.startsAt, language, { dateStyle: 'medium' })} – {formatDate(entitlement.endsAt, language, { dateStyle: 'medium' })}</p>
      {entitlement.note && <p className="timeline-note">{entitlement.note}</p>}
      <p className="muted small">
        {entitlement.paymentId
          ? <button type="button" className="text-button small" onClick={() => onOpenPayment(entitlement.paymentId!)}>{text('من تحويل اتقبل', 'From an approved payment')}</button>
          : entitlement.grantedBy ? text(`أضافها ${entitlement.grantedBy}`, `Granted by ${entitlement.grantedBy}`)
            : entitlement.kind === 'TRIAL' ? text('تجربة تلقائية عند التسجيل', 'Automatic trial at sign-up') : null}
      </p>
    </div>
  </li>;
}

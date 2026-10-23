import { Link } from 'react-router';
import { ArrowLeftIcon, CheckCircleIcon, PackageIcon, ReceiptIcon } from '@phosphor-icons/react';
import type { AccessStatus, AdminOverview } from '@bilhanah/contracts';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Section } from '../../../components/Section';
import { PageSkeleton } from '../../../components/Skeleton';
import { formatPrice } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useAdminOverview } from '../queries';
import { ACCESS_LABELS } from '../shared';

const STATUSES: AccessStatus[] = ['TRIAL', 'PAID', 'INACTIVE', 'SUSPENDED'];

/** The team's morning view: what is waiting for someone, then the state of the platform. */
export function AdminOverviewPage() {
  const { text } = useLanguage();
  usePageTitle('نظرة عامة', 'Overview');
  const overview = useAdminOverview();
  if (overview.isPending) return <PageSkeleton blocks={2} />;
  if (overview.isError) return <div className="page"><ErrorPanel error={overview.error} onRetry={() => void overview.refetch()} /></div>;
  return <div className="page">
    <PageHeader title={text('نظرة عامة', 'Overview')} />
    <Waiting overview={overview.data} />
    <Kpis overview={overview.data} />
    <StatusBreakdown overview={overview.data} />
    <MoreLinks />
  </div>;
}

/** Payments to review and stand orders to confirm: the work for today. */
function Waiting({ overview }: { overview: AdminOverview }) {
  const { text, count } = useLanguage();
  const payments = overview.pendingPayments;
  const stands = overview.newStandOrders;
  const paymentsCount = count(payments, [{ one: 'تحويل واحد مستني المراجعة', two: 'تحويلين مستنيين المراجعة', few: '{n} تحويلات مستنية المراجعة', many: '{n} تحويل مستني المراجعة' }, { one: '{n} payment to review', other: '{n} payments to review' }]);
  const standsCount = count(stands, [{ one: 'طلب ستاند جديد', two: 'طلبين ستاندات جداد', few: '{n} طلبات ستاندات جديدة', many: '{n} طلب ستاندات جديد' }, { one: '{n} new stand order', other: '{n} new stand orders' }]);
  return <section className="attention-list" aria-label={text('مستني منك', 'Waiting for you')}>
    <Link to="/admin/payments" className={`attention ${payments ? '' : 'is-calm'}`} data-testid="kpi-pending">
      {payments ? <ReceiptIcon size={22} weight="bold" aria-hidden="true" /> : <CheckCircleIcon size={22} weight="fill" aria-hidden="true" />}
      <span>
        <strong>{payments
          ? paymentsCount
          : text('مفيش تحويلات مستنية', 'No payments to review')}</strong>
        <small>{payments ? text('افتح قائمة المراجعة', 'Open the review queue') : text('كل التحويلات اتراجعت', 'Every transfer has been reviewed')}</small>
      </span>
      <ArrowLeftIcon size={18} className="directional" aria-hidden="true" />
    </Link>
    <Link to="/admin/stand-orders?status=NEW" className={`attention ${stands ? '' : 'is-calm'}`} data-testid="kpi-stand-orders">
      {stands ? <PackageIcon size={22} weight="bold" aria-hidden="true" /> : <CheckCircleIcon size={22} weight="fill" aria-hidden="true" />}
      <span>
        <strong>{stands
          ? standsCount
          : text('مفيش طلبات ستاندات جديدة', 'No new stand orders')}</strong>
        <small>{stands ? text('كلّم العميل وأكّد الطلب', 'Call the customer to confirm') : text('افتح طلبات الستاندات', 'Open stand orders')}</small>
      </span>
      <ArrowLeftIcon size={18} className="directional" aria-hidden="true" />
    </Link>
  </section>;
}

function Kpis({ overview }: { overview: AdminOverview }) {
  const { text, number, language } = useLanguage();
  return <section aria-labelledby="kpi-title">
    <h2 id="kpi-title" className="visually-hidden">{text('المؤشرات', 'Key figures')}</h2>
    <div className="card kpi-band">
      <div className="kpi" data-testid="kpi-mrr">
        <span>{text('الإيراد الشهري المتكرر', 'Monthly recurring revenue')}</span>
        <strong>{formatPrice(overview.monthlyRecurringPiastres, language)}</strong>
        <small>{text('المطاعم المشتركة بأسعار باقاتها', 'Paying restaurants at their plan prices')}</small>
      </div>
      <Link to="/admin/restaurants" className="kpi" data-testid="kpi-total">
        <span>{text('كل المطاعم', 'All restaurants')}</span>
        <strong>{number(overview.restaurants.total)}</strong>
      </Link>
      <div className="kpi" data-testid="kpi-new">
        <span>{text('مطاعم جديدة آخر ٣٠ يوم', 'New in the last 30 days')}</span>
        <strong>{number(overview.newRestaurantsLast30Days)}</strong>
      </div>
      <div className="kpi" data-testid="kpi-expiring">
        <span>{text('بتخلص خلال ٧ أيام', 'Ending within 7 days')}</span>
        <strong>{number(overview.expiringSoon)}</strong>
        <small>{text('تجارب ومدد مدفوعة من غير تجديد', 'Trials and paid periods with nothing after them')}</small>
      </div>
    </div>
  </section>;
}

function StatusBreakdown({ overview }: { overview: AdminOverview }) {
  const { text, number } = useLanguage();
  const total = Math.max(1, overview.restaurants.total);
  return <Section id="breakdown-title" title={text('المطاعم حسب الحالة', 'Restaurants by status')}>
    <div className="status-bar" aria-hidden="true">
      {STATUSES.map(status => overview.restaurants[status] > 0 && <span key={status} className={`status-bar-${status.toLowerCase()}`} style={{ flexGrow: overview.restaurants[status] / total }} />)}
    </div>
    <ul className="status-legend">
      {STATUSES.map(status => <li key={status}>
        <Link to={`/admin/restaurants?access=${status}`} data-testid={`status-${status}`}>
          <span className={`legend-dot status-dot-${status.toLowerCase()}`} aria-hidden="true" />
          <span>{text(...ACCESS_LABELS[status])}</span>
          <strong>{number(overview.restaurants[status])}</strong>
          <small>{number(overview.restaurants[status] / total, { style: 'percent', maximumFractionDigits: 0 })}</small>
        </Link>
      </li>)}
    </ul>
  </Section>;
}

/** Pages that are not in the phone tab bar. */
function MoreLinks() {
  const { text } = useLanguage();
  return <nav className="more-links" aria-label={text('صفحات تانية', 'More pages')}>
    <Link className="link-action" to="/admin/stats">{text('التقارير يوم بيوم', 'Daily reports')}<ArrowLeftIcon size={14} className="directional" aria-hidden="true" /></Link>
    <Link className="link-action" to="/admin/audit">{text('سجل المراجعة', 'Audit log')}<ArrowLeftIcon size={14} className="directional" aria-hidden="true" /></Link>
  </nav>;
}

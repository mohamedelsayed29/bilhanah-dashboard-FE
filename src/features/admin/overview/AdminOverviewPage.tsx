import { Link } from 'react-router';
import { ArrowLeftIcon, CalendarXIcon, ChartBarIcon, ClipboardTextIcon, CurrencyCircleDollarIcon, HourglassMediumIcon, PackageIcon, SparkleIcon, StorefrontIcon } from '@phosphor-icons/react';
import type { AccessStatus, AdminOverview } from '@bilhanah/contracts';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { PageSkeleton } from '../../../components/Skeleton';
import { formatPrice } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useSession } from '../../../lib/session';
import { useAdminOverview } from '../queries';
import { ACCESS_LABELS } from '../shared';

const STATUSES: AccessStatus[] = ['TRIAL', 'PAID', 'INACTIVE', 'SUSPENDED'];

export function AdminOverviewPage() {
  const { text } = useLanguage();
  usePageTitle('نظرة عامة', 'Overview');
  const session = useSession();
  const overview = useAdminOverview();
  const firstName = session.status === 'authenticated' ? session.user.fullName.split(' ')[0] : '';
  if (overview.isPending) return <PageSkeleton blocks={2} />;
  if (overview.isError) return <div className="page"><ErrorPanel error={overview.error} onRetry={() => void overview.refetch()} /></div>;
  return <div className="page">
    <PageHeader eyebrow={text(`أهلًا يا ${firstName}`, `Hello, ${firstName}`)} title={text('نظرة عامة', 'Overview')}
      description={text('حالة المطاعم والاشتراكات على بالهنا النهارده.', 'Restaurants and subscriptions on Bilhanah today.')} />
    <Kpis overview={overview.data} />
    <StatusBreakdown overview={overview.data} />
    <MoreLinks />
  </div>;
}

function Kpis({ overview }: { overview: AdminOverview }) {
  const { text, number, language } = useLanguage();
  return <section aria-labelledby="kpi-title">
    <h2 id="kpi-title" className="visually-hidden">{text('المؤشرات', 'Key figures')}</h2>
    <div className="kpi-grid kpi-grid-even">
      <Link to="/admin/payments" className={`kpi card ${overview.pendingPayments ? 'kpi-attention' : ''}`} data-testid="kpi-pending">
        <span className="kpi-icon" aria-hidden="true"><HourglassMediumIcon size={22} /></span>
        <strong>{number(overview.pendingPayments)}</strong>
        <span>{text('تحويلات مستنية المراجعة', 'Payments waiting for review')}</span>
        <small className="kpi-link">{text('افتح قائمة المراجعة', 'Open the review queue')}<ArrowLeftIcon size={14} className="directional" aria-hidden="true" /></small>
      </Link>
      <Link to="/admin/stand-orders?status=NEW" className={`kpi card ${overview.newStandOrders ? 'kpi-attention' : ''}`} data-testid="kpi-stand-orders">
        <span className="kpi-icon" aria-hidden="true"><PackageIcon size={22} /></span>
        <strong>{number(overview.newStandOrders)}</strong>
        <span>{text('طلبات ستاندات جديدة', 'New stand orders')}</span>
        <small className="kpi-link">{text('افتح طلبات الستاندات', 'Open stand orders')}<ArrowLeftIcon size={14} className="directional" aria-hidden="true" /></small>
      </Link>
      <div className="kpi card" data-testid="kpi-mrr">
        <span className="kpi-icon" aria-hidden="true"><CurrencyCircleDollarIcon size={22} /></span>
        <strong>{formatPrice(overview.monthlyRecurringPiastres, language)}</strong>
        <span>{text('الإيراد الشهري المتكرر', 'Monthly recurring revenue')}</span>
        <small>{text('من المطاعم المشتركة حاليًا بأسعار باقاتها', 'From paying restaurants at their plan prices')}</small>
      </div>
      <Link to="/admin/restaurants" className="kpi card" data-testid="kpi-total">
        <span className="kpi-icon" aria-hidden="true"><StorefrontIcon size={22} /></span>
        <strong>{number(overview.restaurants.total)}</strong>
        <span>{text('إجمالي المطاعم', 'Restaurants in total')}</span>
      </Link>
      <div className="kpi card" data-testid="kpi-expiring">
        <span className="kpi-icon" aria-hidden="true"><CalendarXIcon size={22} /></span>
        <strong>{number(overview.expiringSoon)}</strong>
        <span>{text('اشتراكات بتخلص خلال ٧ أيام', 'Ending within 7 days')}</span>
        <small>{text('تجارب ومدد مدفوعة من غير تجديد', 'Trials and paid periods with nothing after them')}</small>
      </div>
      <div className="kpi card" data-testid="kpi-new">
        <span className="kpi-icon" aria-hidden="true"><SparkleIcon size={22} /></span>
        <strong>{number(overview.newRestaurantsLast30Days)}</strong>
        <span>{text('مطاعم جديدة آخر ٣٠ يوم', 'New in the last 30 days')}</span>
      </div>
    </div>
  </section>;
}

function StatusBreakdown({ overview }: { overview: AdminOverview }) {
  const { text, number } = useLanguage();
  const total = Math.max(1, overview.restaurants.total);
  return <section className="card card-padded" aria-labelledby="breakdown-title">
    <div className="card-header"><div>
      <h2 id="breakdown-title">{text('المطاعم حسب الحالة', 'Restaurants by status')}</h2>
      <p>{text('اضغط على أي حالة عشان تشوف مطاعمها.', 'Select a status to see its restaurants.')}</p>
    </div></div>
    <div className="status-bar" aria-hidden="true">
      {STATUSES.map(status => overview.restaurants[status] > 0 && <span key={status} className={`status-bar-${status.toLowerCase()}`} style={{ flexGrow: overview.restaurants[status] / total }} />)}
    </div>
    <ul className="status-legend">
      {STATUSES.map(status => <li key={status}>
        <Link to={`/admin/restaurants?access=${status}`} data-testid={`status-${status}`}>
          <span className={`legend-dot status-dot-${status.toLowerCase()}`} aria-hidden="true" />
          <span>{text(...ACCESS_LABELS[status])}</span>
          <strong>{number(overview.restaurants[status])}</strong>
          <small>{text(`${number(Math.round((overview.restaurants[status] / total) * 100))}٪`, `${Math.round((overview.restaurants[status] / total) * 100)}%`)}</small>
        </Link>
      </li>)}
    </ul>
  </section>;
}

/** Pages that are not in the phone tab bar. */
function MoreLinks() {
  const { text } = useLanguage();
  const links = [
    { to: '/admin/stats', icon: ChartBarIcon, title: text('التقارير', 'Reports'), body: text('زيارات وطلبات وإيرادات يوم بيوم', 'Visits, orders and revenue day by day') },
    { to: '/admin/audit', icon: ClipboardTextIcon, title: text('سجل المراجعة', 'Audit log'), body: text('كل تغيير عمله الفريق', 'Every change the team made') },
  ];
  return <section className="card card-padded" aria-labelledby="more-title">
    <div className="card-header"><h2 id="more-title">{text('صفحات تانية', 'More')}</h2></div>
    <ul className="quick-links quick-links-row">
      {links.map(link => <li key={link.to}><Link to={link.to}>
        <span className="quick-icon" aria-hidden="true"><link.icon size={20} /></span>
        <span><strong>{link.title}</strong><small>{link.body}</small></span>
      </Link></li>)}
    </ul>
  </section>;
}

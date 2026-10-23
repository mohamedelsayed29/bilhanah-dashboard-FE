import { Link } from 'react-router';
import { ArrowLeftIcon, CalendarXIcon, CurrencyCircleDollarIcon, HourglassMediumIcon, SparkleIcon, StorefrontIcon } from '@phosphor-icons/react';
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
  </div>;
}

function Kpis({ overview }: { overview: AdminOverview }) {
  const { text, number, language } = useLanguage();
  return <section aria-labelledby="kpi-title">
    <h2 id="kpi-title" className="visually-hidden">{text('المؤشرات', 'Key figures')}</h2>
    <div className="kpi-grid">
      <Link to="/admin/payments" className={`kpi card ${overview.pendingPayments ? 'kpi-attention' : ''}`} data-testid="kpi-pending">
        <span className="kpi-icon" aria-hidden="true"><HourglassMediumIcon size={22} /></span>
        <strong>{number(overview.pendingPayments)}</strong>
        <span>{text('تحويلات مستنية المراجعة', 'Payments waiting for review')}</span>
        <small className="kpi-link">{text('افتح قائمة المراجعة', 'Open the review queue')}<ArrowLeftIcon size={14} className="directional" aria-hidden="true" /></small>
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

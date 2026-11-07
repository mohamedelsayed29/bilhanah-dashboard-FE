import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, ClipboardTextIcon, CoinsIcon, HourglassMediumIcon, PackageIcon, ReceiptIcon, StorefrontIcon, TrendUpIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { AccessStatus, AdminOverview, PlatformStats, StatsPeriod } from '@bilhanah/contracts';
import { AreaChart, type AreaPoint } from '../../../components/charts/AreaChart';
import { Donut, type DonutSlice } from '../../../components/charts/Donut';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { PageSkeleton, Skeleton } from '../../../components/Skeleton';
import { adminApi } from '../../../lib/api/endpoints';
import { formatPrice } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useAdminOverview } from '../queries';
import { ACCESS_LABELS } from '../shared';

const STATUSES: AccessStatus[] = ['TRIAL', 'PAID', 'INACTIVE', 'SUSPENDED'];
const STATUS_COLORS: Record<AccessStatus, string> = { TRIAL: 'var(--ad-yellow)', PAID: 'var(--ad-green)', INACTIVE: 'var(--ad-grey)', SUSPENDED: 'var(--ad-red)' };
const PERIODS: StatsPeriod[] = [7, 30, 90];
type Metric = 'orders' | 'visits' | 'revenuePiastres' | 'newRestaurants';

/** The team's morning view: what is waiting, the platform's headline figures, and its trends. */
export function AdminOverviewPage() {
  const { text, number } = useLanguage();
  usePageTitle('نظرة عامة', 'Overview');
  const overview = useAdminOverview();
  const [days, setDays] = useState<StatsPeriod>(30);
  const stats = useQuery({ queryKey: ['admin', 'stats', days], queryFn: ({ signal }) => adminApi.stats(days, signal), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  if (overview.isPending) return <PageSkeleton blocks={3} />;
  if (overview.isError) return <div className="page"><ErrorPanel error={overview.error} onRetry={() => void overview.refetch()} /></div>;
  return <div className="page ad-overview">
    <PageHeader title={text('نظرة عامة', 'Overview')} description={text('حالة بالهنا النهارده: اللي مستني منك، والأرقام، والاتجاه.', 'Bilhanah today: what is waiting for you, the figures, and the trend.')}
      actions={<div className="ad-periods" role="group" aria-label={text('الفترة', 'Period')}>{PERIODS.map(value => <button key={value} type="button" className={days === value ? 'active' : ''} aria-pressed={days === value} onClick={() => setDays(value)}>{text(`${number(value)} يوم`, `${value} days`)}</button>)}</div>} />
    <Waiting overview={overview.data} />
    <Kpis overview={overview.data} stats={stats.data} days={days} />
    {stats.isError && !stats.data && <ErrorPanel error={stats.error} onRetry={() => void stats.refetch()} />}
    {!stats.data ? <div className="ad-row"><Skeleton height={340} radius={24} /><Skeleton height={340} radius={24} /></div> : <>
      <div className="ad-row">
        <Trend stats={stats.data} days={days} />
        <Statuses overview={overview.data} />
      </div>
      <div className="ad-row ad-row-even">
        <NewRestaurants stats={stats.data} />
        <TopRestaurants stats={stats.data} />
      </div>
    </>}
    <nav className="ad-links" aria-label={text('روابط', 'Links')}>
      <QuickLink to="/admin/stats" icon={TrendUpIcon} label={text('التقارير اليومية', 'Daily reports')} />
      <QuickLink to="/admin/restaurants" icon={StorefrontIcon} label={text('كل المطاعم', 'All restaurants')} />
      <QuickLink to="/admin/audit" icon={ClipboardTextIcon} label={text('سجل المراجعة', 'Audit log')} />
    </nav>
  </div>;
}

function QuickLink({ to, icon: LinkIcon, label }: { to: string; icon: Icon; label: string }) {
  const { language } = useLanguage();
  const Arrow = language === 'ar' ? ArrowLeftIcon : ArrowRightIcon;
  return <Link to={to} className="ad-link"><span className="ad-icon tone-plum" aria-hidden="true"><LinkIcon size={18} weight="bold" /></span>{label}<Arrow size={16} aria-hidden="true" /></Link>;
}

/** Payments to review and stand orders to confirm: the work for today. */
function Waiting({ overview }: { overview: AdminOverview }) {
  const { text, count, language } = useLanguage();
  const Arrow = language === 'ar' ? ArrowLeftIcon : ArrowRightIcon;
  const items = [
    { to: '/admin/payments', testId: 'kpi-pending', busy: overview.pendingPayments > 0, icon: ReceiptIcon,
      title: overview.pendingPayments ? count(overview.pendingPayments, [{ one: 'تحويل واحد مستني المراجعة', two: 'تحويلين مستنيين المراجعة', few: '{n} تحويلات مستنية المراجعة', many: '{n} تحويل مستني المراجعة' }, { one: '{n} payment to review', other: '{n} payments to review' }]) : text('مفيش تحويلات مستنية', 'No payments to review'),
      note: overview.pendingPayments ? text('افتح قائمة المراجعة', 'Open the review queue') : text('كل التحويلات اتراجعت', 'Every transfer has been reviewed') },
    { to: '/admin/stand-orders?status=NEW', testId: 'kpi-stand-orders', busy: overview.newStandOrders > 0, icon: PackageIcon,
      title: overview.newStandOrders ? count(overview.newStandOrders, [{ one: 'طلب ستاند جديد', two: 'طلبين ستاندات جداد', few: '{n} طلبات ستاندات جديدة', many: '{n} طلب ستاندات جديد' }, { one: '{n} new stand order', other: '{n} new stand orders' }]) : text('مفيش طلبات ستاندات جديدة', 'No new stand orders'),
      note: overview.newStandOrders ? text('كلّم العميل وأكّد الطلب', 'Call the customer to confirm') : text('افتح طلبات الستاندات', 'Open stand orders') },
  ];
  return <section className="ad-waiting" aria-label={text('مستني منك', 'Waiting for you')}>
    {items.map(item => <Link key={item.to} to={item.to} className={`ad-card ad-attention ${item.busy ? 'is-busy' : ''}`} data-testid={item.testId}>
      <span className={`ad-icon ${item.busy ? 'tone-coral' : 'tone-green'}`} aria-hidden="true">{item.busy ? <item.icon size={20} weight="bold" /> : <CheckCircleIcon size={20} weight="bold" />}</span>
      <span className="ad-attention-text"><strong>{item.title}</strong><small>{item.note}</small></span>
      <Arrow size={18} aria-hidden="true" />
    </Link>)}
  </section>;
}

/** A small line under a figure: its shape over the period. */
function Spark({ values, tone }: { values: number[]; tone: string }) {
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${values.length > 1 ? (index / (values.length - 1)) * 100 : 50},${28 - (value / max) * 26}`).join(' ');
  return <svg className={`ad-spark tone-${tone}`} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>;
}

function Kpis({ overview, stats, days }: { overview: AdminOverview; stats: PlatformStats | undefined; days: number }) {
  const { text, number, language } = useLanguage();
  const series = (pick: (day: PlatformStats['days'][number]) => number) => stats?.days.map(pick) ?? [];
  const cards: { key: string; icon: Icon; tone: string; label: string; value: string; note: string; spark: number[]; to?: string }[] = [
    { key: 'mrr', icon: CoinsIcon, tone: 'coral', label: text('الإيراد الشهري المتكرر', 'Monthly recurring revenue'), value: formatPrice(overview.monthlyRecurringPiastres, language), note: text('المطاعم المدفوعة بأسعار باقاتها', 'Paying restaurants at their plan prices'), spark: series(day => day.revenuePiastres) },
    { key: 'total', icon: StorefrontIcon, tone: 'plum', label: text('كل المطاعم', 'All restaurants'), value: number(overview.restaurants.total), note: text(`+${number(overview.newRestaurantsLast30Days)} في آخر ٣٠ يوم`, `+${overview.newRestaurantsLast30Days} in the last 30 days`), spark: series(day => day.newRestaurants), to: '/admin/restaurants' },
    { key: 'orders', icon: ReceiptIcon, tone: 'green', label: text(`طلبات آخر ${number(days)} يوم`, `Orders, last ${days} days`), value: stats ? number(stats.totals.orders) : '—', note: stats ? text(`${number(stats.totals.visits)} زيارة للمنيو`, `${stats.totals.visits} menu visits`) : '', spark: series(day => day.orders) },
    { key: 'expiring', icon: HourglassMediumIcon, tone: 'yellow', label: text('بينتهي خلال ٧ أيام', 'Ending within 7 days'), value: number(overview.expiringSoon), note: text('تجارب واشتراكات من غير تجديد', 'Trials and paid periods with nothing after them'), spark: [] },
  ];
  return <section className="ad-kpis" aria-label={text('الأرقام الأساسية', 'Headline figures')}>
    {cards.map(card => {
      const body = <>
        <div className="ad-kpi-head"><span className={`ad-icon tone-${card.tone}`} aria-hidden="true"><card.icon size={20} weight="bold" /></span><span className="ad-kpi-label">{card.label}</span></div>
        <strong className="ad-kpi-value">{card.value}</strong>
        <small>{card.note}</small>
        {card.spark.length > 1 && <Spark values={card.spark} tone={card.tone} />}
      </>;
      return card.to ? <Link key={card.key} to={card.to} className="ad-card ad-kpi" data-testid={`kpi-${card.key}`}>{body}</Link> : <div key={card.key} className="ad-card ad-kpi" data-testid={`kpi-${card.key}`}>{body}</div>;
    })}
  </section>;
}

/** The platform day by day: orders, visits, subscription revenue or new restaurants. */
function Trend({ stats, days }: { stats: PlatformStats; days: number }) {
  const { text, number, language } = useLanguage();
  const [metric, setMetric] = useState<Metric>('orders');
  const locale = language === 'ar' ? 'ar-EG' : 'en-GB';
  const label = (date: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  const money = metric === 'revenuePiastres';
  const points: AreaPoint[] = stats.days.map(day => ({ key: day.date, label: label(day.date), value: money ? day[metric] / 100 : day[metric], tooltip: money ? formatPrice(day[metric], language) : number(day[metric]) }));
  const metrics: [Metric, string, string, number][] = [
    ['orders', 'الطلبات', 'Orders', stats.totals.orders], ['visits', 'زيارات المنيو', 'Menu visits', stats.totals.visits],
    ['revenuePiastres', 'إيراد الاشتراكات', 'Subscription revenue', stats.totals.revenuePiastres], ['newRestaurants', 'مطاعم جديدة', 'New restaurants', stats.totals.newRestaurants],
  ];
  return <section className="ad-card ad-chart" aria-labelledby="ad-trend-title">
    <header className="ad-card-head"><div><h2 id="ad-trend-title">{text('الاتجاه', 'Trend')}</h2><p className="muted">{text(`آخر ${number(days)} يوم، بتوقيت القاهرة`, `Last ${days} days, Cairo time`)}</p></div>
      <div className="ad-metrics" role="group" aria-label={text('المؤشر', 'Metric')}>{metrics.map(([key, ar, en, total]) => <button key={key} type="button" className={metric === key ? 'active' : ''} aria-pressed={metric === key} onClick={() => setMetric(key)}>
        <span>{text(ar, en)}</span><strong>{key === 'revenuePiastres' ? formatPrice(total, language) : number(total)}</strong>
      </button>)}</div>
    </header>
    <AreaChart points={points} label={text('الاتجاه', 'Trend')} axisFormat={value => number(value, { notation: 'compact', maximumFractionDigits: 1 })} />
  </section>;
}

function Statuses({ overview }: { overview: AdminOverview }) {
  const { text, number } = useLanguage();
  const total = Math.max(1, overview.restaurants.total);
  const slices: DonutSlice[] = STATUSES.map(status => ({ key: status, label: text(...ACCESS_LABELS[status]), value: overview.restaurants[status], color: STATUS_COLORS[status], detail: `${number(overview.restaurants[status])} · ${number(overview.restaurants[status] / total, { style: 'percent', maximumFractionDigits: 0 })}` }));
  return <section className="ad-card ad-donut-card" aria-labelledby="ad-status-title">
    <header className="ad-card-head"><h2 id="ad-status-title">{text('المطاعم حسب الحالة', 'Restaurants by status')}</h2></header>
    <Donut slices={slices} total={number(overview.restaurants.total)} label={text('المطاعم حسب الحالة', 'Restaurants by status')} />
  </section>;
}

/** New restaurants each day, as columns. */
function NewRestaurants({ stats }: { stats: PlatformStats }) {
  const { text, number, language } = useLanguage();
  const max = Math.max(1, ...stats.days.map(day => day.newRestaurants));
  const locale = language === 'ar' ? 'ar-EG' : 'en-GB';
  const every = Math.max(1, Math.ceil(stats.days.length / 8));
  return <section className="ad-card" aria-labelledby="ad-new-title">
    <header className="ad-card-head"><div><h2 id="ad-new-title">{text('مطاعم جديدة', 'New restaurants')}</h2><p className="muted">{text(`${number(stats.totals.newRestaurants)} في الفترة`, `${stats.totals.newRestaurants} in the period`)}</p></div></header>
    <div className="ad-columns" role="img" aria-label={text('مطاعم جديدة كل يوم', 'New restaurants per day')}>
      {stats.days.map((day, index) => <div key={day.date} className="ad-column" title={`${day.date}: ${day.newRestaurants}`}>
        <span className="ad-column-bar" style={{ height: `${day.newRestaurants ? Math.max(6, (day.newRestaurants / max) * 100) : 2}%` }} />
        <small>{index % every === 0 ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00Z`)) : ''}</small>
      </div>)}
    </div>
  </section>;
}

function TopRestaurants({ stats }: { stats: PlatformStats }) {
  const { text, number } = useLanguage();
  const max = Math.max(1, ...stats.topRestaurants.map(row => row.visits));
  return <section className="ad-card" aria-labelledby="ad-top-title">
    <header className="ad-card-head"><h2 id="ad-top-title">{text('أكتر المطاعم زيارة', 'Most visited restaurants')}</h2></header>
    {stats.topRestaurants.length === 0 ? <p className="muted">{text('لسه مفيش زيارات في الفترة.', 'No visits in this period yet.')}</p>
      : <ol className="ad-ranking">{stats.topRestaurants.slice(0, 6).map((row, index) => <li key={row.id}>
        <span className="ad-rank">{number(index + 1)}</span>
        <span className="ad-rank-body">
          <span className="ad-rank-line"><Link to={`/admin/restaurants/${row.id}`}><bdi>{row.name}</bdi></Link><strong>{number(row.visits)}</strong></span>
          <span className="ad-track" aria-hidden="true"><span style={{ width: `${Math.max(3, (row.visits / max) * 100)}%` }} /></span>
          <small>{text(`${number(row.orders)} طلب`, `${row.orders} orders`)}</small>
        </span>
      </li>)}</ol>}
  </section>;
}

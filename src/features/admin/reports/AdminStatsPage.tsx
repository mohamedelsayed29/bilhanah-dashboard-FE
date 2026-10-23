import { Link } from 'react-router';
import { CoinsIcon, EyeIcon, PackageIcon, ReceiptIcon, SparkleIcon, StorefrontIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { PlatformStats, PlatformStatsDay, StatsPeriod } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { DailyChart, type ChartSeries } from '../../../components/charts/DailyChart';
import { PeriodSwitch, periodLabel, usePeriodParam } from '../../../components/charts/PeriodSwitch';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { completeDays, hasActivity } from '../../../lib/charts';
import { formatCompact, formatCompactPrice, formatPrice } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { usePlatformStatsQuery } from '../queries';

/** Platform reports: visits, orders, new restaurants and revenue per day (Cairo time), and the busiest restaurants. */
export function AdminStatsPage() {
  const { text, number } = useLanguage();
  usePageTitle('التقارير', 'Reports');
  const [days, setDays] = usePeriodParam(30);
  const stats = usePlatformStatsQuery(days);
  return <div className="page">
    <PageHeader title={text('التقارير', 'Reports')}
      description={text('حركة بالهنا كلها: زيارات المنيو، الطلبات، المطاعم الجديدة، إيراد الاشتراكات ومتجر الستاندات. الأيام بتوقيت القاهرة.',
        'All of Bilhanah: menu visits, orders, new restaurants, subscription and stand-shop revenue. Days are in Cairo time.')}
      actions={<PeriodSwitch value={days} onChange={setDays} />} />
    <p className="visually-hidden" role="status" aria-live="polite">
      {stats.isFetching ? text('بنحمّل التقارير…', 'Loading reports…') : stats.data ? text(`بنعرض ${periodLabel(days, text, number)}`, `Showing the ${periodLabel(days, text, number).toLowerCase()}`) : ''}
    </p>
    {stats.isError && !stats.data && <ErrorPanel error={stats.error} onRetry={() => void stats.refetch()} />}
    {stats.isPending && <div className="insights-body" role="status" aria-label={text('جاري التحميل', 'Loading')}>
      <div className="kpi-grid kpi-grid-even">{[0, 1, 2, 3, 4, 5].map(index => <div className="kpi card" key={index}><Skeleton width={70} height={28} /><Skeleton width={120} height={14} /></div>)}</div>
      <div className="card card-padded skeleton-stack"><Skeleton width="30%" height={20} /><Skeleton height={260} /></div>
    </div>}
    {stats.data && <div className={`insights-body ${stats.isPlaceholderData ? 'is-refreshing' : ''}`} aria-busy={stats.isFetching}>
      {stats.isError && <Alert kind="error">{text('مقدرناش نحدّث الأرقام؛ بنعرض آخر أرقام وصلتنا.', 'We couldn’t refresh the figures; showing the last ones we received.')}</Alert>}
      <Report stats={stats.data} days={days} />
    </div>}
  </div>;
}

function Report({ stats, days }: { stats: PlatformStats; days: StatsPeriod }) {
  const { text, number, language } = useLanguage();
  const { totals } = stats;
  const chartDays = completeDays(stats.days, date => ({ date, visits: 0, orders: 0, newRestaurants: 0, revenuePiastres: 0 }));
  const count = (value: number) => number(value);
  const axis = (value: number) => formatCompact(value, language);
  const series: ChartSeries<PlatformStatsDay>[] = [
    { key: 'visits', label: text('زيارات المنيو', 'Menu visits'), format: count, axisFormat: axis },
    { key: 'orders', label: text('الطلبات', 'Orders'), format: count, axisFormat: axis },
    { key: 'newRestaurants', label: text('مطاعم جديدة', 'New restaurants'), format: count, axisFormat: axis },
    { key: 'revenuePiastres', label: text('إيراد الاشتراكات', 'Subscription revenue'), format: value => formatPrice(value, language), axisFormat: value => formatCompactPrice(value, language) },
  ];
  const tiles: { key: string; icon: Icon; value: string; label: string; hint?: string; to?: string }[] = [
    { key: 'visits', icon: EyeIcon, value: number(totals.visits), label: text('زيارة للمنيوهات', 'Menu visits') },
    { key: 'orders', icon: ReceiptIcon, value: number(totals.orders), label: text('طلب من المنيوهات', 'Menu orders'), hint: text('من غير المرفوض والملغي', 'Excluding rejected and cancelled') },
    { key: 'restaurants', icon: SparkleIcon, value: number(totals.newRestaurants), label: text('مطعم جديد', 'New restaurants'), to: '/admin/restaurants' },
    { key: 'revenue', icon: CoinsIcon, value: formatPrice(totals.revenuePiastres, language), label: text('إيراد الاشتراكات', 'Subscription revenue'), hint: text('مدفوعات اتقبلت (تحويلات وأونلاين)', 'Approved payments (transfers and online)'), to: '/admin/payments?status=APPROVED' },
    { key: 'stand-orders', icon: PackageIcon, value: number(totals.standOrders), label: text('طلب ستاندات', 'Stand orders'), to: '/admin/stand-orders?status=all' },
    { key: 'stand-revenue', icon: StorefrontIcon, value: formatPrice(totals.standRevenuePiastres, language), label: text('إيراد الستاندات', 'Stand-shop revenue') },
  ];
  const empty = !hasActivity(chartDays, ['visits', 'orders', 'newRestaurants', 'revenuePiastres']);
  return <>
    <section aria-labelledby="report-kpis">
      <h2 id="report-kpis" className="visually-hidden">{text(`الأرقام، ${periodLabel(days, text, number)}`, `Key figures, ${periodLabel(days, text, number).toLowerCase()}`)}</h2>
      <div className="kpi-grid kpi-grid-even">
        {tiles.map(tile => {
          const body = <>
            <span className="kpi-icon" aria-hidden="true"><tile.icon size={22} /></span>
            <strong>{tile.value}</strong>
            <span>{tile.label}</span>
            {tile.hint && <small>{tile.hint}</small>}
          </>;
          return tile.to
            ? <Link key={tile.key} to={tile.to} className="kpi card" data-testid={`report-${tile.key}`}>{body}</Link>
            : <div key={tile.key} className="kpi card" data-testid={`report-${tile.key}`}>{body}</div>;
        })}
      </div>
    </section>
    <section className="card card-padded" aria-labelledby="report-daily">
      <div className="card-header"><div>
        <h2 id="report-daily">{text('يوم بيوم', 'Day by day')}</h2>
        <p>{text('كل رسم بمقياسه، والأيام مشتركة بينهم.', 'Each chart has its own scale; the days line up across them.')}</p>
      </div></div>
      {empty
        ? <p className="muted empty-line">{text('مفيش حركة في الفترة دي.', 'No activity in this period.')}</p>
        : <DailyChart days={chartDays} series={series} label={text(`حركة المنصة كل يوم، ${periodLabel(days, text, number)}`, `Platform activity per day, ${periodLabel(days, text, number).toLowerCase()}`)} />}
    </section>
    <section className="card list-card" aria-labelledby="top-restaurants">
      <div className="card-header card-padded list-card-header"><div>
        <h2 id="top-restaurants">{text('أكتر المطاعم زيارات', 'Most visited restaurants')}</h2>
        <p>{text('أعلى ١٠ مطاعم في الفترة دي.', 'The top 10 in this period.')}</p>
      </div></div>
      {stats.topRestaurants.length === 0
        ? <p className="muted empty-line card-padded">{text('مفيش زيارات لسه.', 'No visits yet.')}</p>
        : <div className="table-scroll"><table className="data-table" data-testid="top-restaurants">
            <thead><tr>
              <th scope="col">#</th>
              <th scope="col">{text('المطعم', 'Restaurant')}</th>
              <th scope="col">{text('الزيارات', 'Visits')}</th>
              <th scope="col">{text('الطلبات', 'Orders')}</th>
            </tr></thead>
            <tbody>{stats.topRestaurants.map((restaurant, index) => <tr key={restaurant.id}>
              <td className="cell-rank" data-label="#">{number(index + 1)}</td>
              <td className="cell-primary" data-label={text('المطعم', 'Restaurant')}>
                <Link className="table-link" to={`/admin/restaurants/${restaurant.id}`}>{restaurant.name}</Link>
                <small className="ltr">{restaurant.subdomain}</small>
              </td>
              <td data-label={text('الزيارات', 'Visits')}>{number(restaurant.visits)}</td>
              <td data-label={text('الطلبات', 'Orders')}>{number(restaurant.orders)}</td>
            </tr>)}</tbody>
          </table></div>}
    </section>
  </>;
}

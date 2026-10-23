import { Link } from 'react-router';
import type { PlatformStats, PlatformStatsDay, StatsPeriod } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { DailyChart, type ChartSeries } from '../../../components/charts/DailyChart';
import { PeriodSwitch, periodLabel, usePeriodParam } from '../../../components/charts/PeriodSwitch';
import { CompactMeta } from '../../../components/CompactMeta';
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
      <div className="card kpi-band kpi-band-3">{[0, 1, 2, 3, 4, 5].map(index => <div className="kpi" key={index}><Skeleton width={120} height={14} /><Skeleton width={70} height={28} /></div>)}</div>
      <div className="skeleton-stack"><Skeleton width="30%" height={20} /><Skeleton height={260} /></div>
    </div>}
    {stats.data && <div className={`insights-body ${stats.isPlaceholderData ? 'is-refreshing' : ''}`} aria-busy={stats.isFetching}>
      {stats.isError && <Alert kind="error">{text('مقدرناش نحدّث الأرقام؛ بنعرض آخر أرقام وصلتنا.', 'We couldn’t refresh the figures; showing the last ones we received.')}</Alert>}
      <Report stats={stats.data} days={days} />
    </div>}
  </div>;
}

function Report({ stats, days }: { stats: PlatformStats; days: StatsPeriod }) {
  const { text, number, count: counted, language } = useLanguage();
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
  const tiles: { key: string; value: string; label: string; hint?: string; to?: string }[] = [
    { key: 'visits', value: number(totals.visits), label: text('زيارات المنيوهات', 'Menu visits') },
    { key: 'orders', value: number(totals.orders), label: text('طلبات المنيوهات', 'Menu orders'), hint: text('من غير المرفوض والملغي', 'Excluding rejected and cancelled') },
    { key: 'restaurants', value: number(totals.newRestaurants), label: text('مطاعم جديدة', 'New restaurants'), to: '/admin/restaurants' },
    { key: 'revenue', value: formatPrice(totals.revenuePiastres, language), label: text('إيراد الاشتراكات', 'Subscription revenue'), hint: text('مدفوعات اتقبلت (تحويلات وأونلاين)', 'Approved payments (transfers and online)'), to: '/admin/payments?status=APPROVED' },
    { key: 'stand-orders', value: number(totals.standOrders), label: text('طلبات الستاندات', 'Stand orders'), to: '/admin/stand-orders?status=all' },
    { key: 'stand-revenue', value: formatPrice(totals.standRevenuePiastres, language), label: text('إيراد الستاندات', 'Stand-shop revenue') },
  ];
  const empty = !hasActivity(chartDays, ['visits', 'orders', 'newRestaurants', 'revenuePiastres']);
  return <>
    <section aria-labelledby="report-kpis">
      <h2 id="report-kpis" className="visually-hidden">{text(`الأرقام، ${periodLabel(days, text, number)}`, `Key figures, ${periodLabel(days, text, number).toLowerCase()}`)}</h2>
      <div className="card kpi-band kpi-band-3">
        {tiles.map(tile => {
          const body = <>
            <span>{tile.label}</span>
            <strong>{tile.value}</strong>
            {tile.hint && <small>{tile.hint}</small>}
          </>;
          return tile.to
            ? <Link key={tile.key} to={tile.to} className="kpi" data-testid={`report-${tile.key}`}>{body}</Link>
            : <div key={tile.key} className="kpi" data-testid={`report-${tile.key}`}>{body}</div>;
        })}
      </div>
    </section>
    <section className="section" aria-labelledby="report-daily">
    <div className="section-head"><div><h2 id="report-daily">{text('يوم بيوم', 'Day by day')}</h2><p>{text('كل رسم بمقياسه، والأيام مشتركة بينهم.', 'Each chart has its own scale; the days line up across them.')}</p></div></div>
      {empty
        ? <p className="muted empty-line">{text('مفيش حركة في الفترة دي.', 'No activity in this period.')}</p>
        : <DailyChart days={chartDays} series={series} label={text(`حركة المنصة كل يوم، ${periodLabel(days, text, number)}`, `Platform activity per day, ${periodLabel(days, text, number).toLowerCase()}`)} />}
    </section>
    <section className="section" aria-labelledby="top-restaurants">
      <div className="section-head"><div><h2 id="top-restaurants">{text('أكتر المطاعم زيارات', 'Most visited restaurants')}</h2><p>{text('أعلى ١٠ مطاعم في الفترة دي.', 'The top 10 in this period.')}</p></div></div>
      {stats.topRestaurants.length === 0
        ? <p className="muted empty-line">{text('مفيش زيارات لسه.', 'No visits yet.')}</p>
        : <div className="card list-card table-scroll"><table className="data-table" data-testid="top-restaurants">
            <thead><tr>
              <th scope="col">#</th>
              <th scope="col">{text('المطعم', 'Restaurant')}</th>
              <th scope="col">{text('الزيارات', 'Visits')}</th>
              <th scope="col">{text('الطلبات', 'Orders')}</th>
            </tr></thead>
            <tbody>{stats.topRestaurants.map((restaurant, index) => <tr key={restaurant.id}>
              <td className="cell-rank" data-label="#">{number(index + 1)}</td>
              <td className="cell-primary" data-label={text('المطعم', 'Restaurant')}>
                <Link className="table-link row-link" to={`/admin/restaurants/${restaurant.id}`}><bdi>{restaurant.name}</bdi></Link>
                <small className="ltr">{restaurant.subdomain}</small>
              </td>
              <td data-label={text('الزيارات', 'Visits')}>{number(restaurant.visits)}</td>
              <td data-label={text('الطلبات', 'Orders')}>{number(restaurant.orders)}</td>
              <CompactMeta parts={[counted(restaurant.visits, 'visit'), counted(restaurant.orders, 'order')]} />
            </tr>)}</tbody>
          </table></div>}
    </section>
  </>;
}

import { Link } from 'react-router';
import { ArrowLeftIcon, ChartBarIcon } from '@phosphor-icons/react';
import { barHeight, niceMax } from '../../../lib/charts';
import { formatPrice } from '../../../lib/format';
import { useLanguage } from '../../../lib/language';
import { Skeleton } from '../../../components/Skeleton';
import { useStatsQuery } from '../queries';
import { statsDays } from './insights';

/** The last 7 days on the overview: visits (and orders and revenue with ordering), linking to the full insights. */
export function InsightsSummary() {
  const { text, number, language } = useLanguage();
  const stats = useStatsQuery(7);
  const data = stats.data;
  const days = data ? statsDays(data) : [];
  const top = niceMax(Math.max(0, ...days.map(day => day.visits)));
  return <section className="card card-padded insights-summary" aria-labelledby="summary-title" data-testid="insights-summary">
    <div className="card-header">
      <div>
        <span className="eyebrow"><ChartBarIcon size={16} aria-hidden="true" />{text('آخر ٧ أيام', 'Last 7 days')}</span>
        <h2 id="summary-title" className="section-title">{text('الزيارات والطلبات', 'Visits and orders')}</h2>
      </div>
      <Link className="link summary-link" to="/insights">{text('كل الإحصائيات', 'All insights')}<ArrowLeftIcon size={14} className="directional" aria-hidden="true" /></Link>
    </div>
    {stats.isPending && <div className="summary-figures" role="status" aria-label={text('جاري التحميل', 'Loading')}>
      {[0, 1, 2].map(index => <div key={index}><Skeleton width={56} height={26} /><Skeleton width={80} height={13} /></div>)}
    </div>}
    {stats.isError && !data && <p className="muted small">{text('مقدرناش نجيب الأرقام دلوقتي.', 'We couldn’t load the figures right now.')}{' '}
      <button type="button" className="text-button small" onClick={() => void stats.refetch()}>{text('حاول تاني', 'Try again')}</button></p>}
    {data && <div className="summary-body">
      <dl className="summary-figures">
        <div data-testid="summary-visits"><dt>{text('زيارة', 'Visits')}</dt><dd>{number(data.totals.visits)}</dd></div>
        {data.ordering && <>
          <div data-testid="summary-orders"><dt>{text('طلب', 'Orders')}</dt><dd>{number(data.totals.orders)}</dd></div>
          <div><dt>{text('إيراد', 'Revenue')}</dt><dd>{formatPrice(data.totals.revenuePiastres, language)}</dd></div>
        </>}
      </dl>
      {/* Decorative: the numbers above say the same; the full chart is on the insights page. */}
      <div className="summary-spark" aria-hidden="true">
        {days.map(day => <span key={day.date} style={{ height: `${Math.max(day.visits > 0 ? 6 : 2, (barHeight(day.visits, top, 100)))}%` }} />)}
      </div>
    </div>}
  </section>;
}

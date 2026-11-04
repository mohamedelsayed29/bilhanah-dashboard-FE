import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowSquareOutIcon, CaretRightIcon, CheckCircleIcon, GiftIcon, MagnifyingGlassIcon, PauseCircleIcon, ProhibitIcon, SquaresFourIcon, StorefrontIcon, XIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { AccessStatus, AdminRestaurantRow } from '@bilhanah/contracts';
import { CompactMeta } from '../../../components/CompactMeta';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Pagination } from '../../../components/Pagination';
import { Skeleton } from '../../../components/Skeleton';
import { formatDate, formatRelative } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useDebounced } from '../../../lib/use-debounced';
import { planName } from '../../billing/labels';
import { accessDaysLeft, accessTone } from '../../restaurant/access';
import { useAdminOverview, useRestaurantsQuery } from '../queries';
import { ACCESS_LABELS, pageParam, useListParams } from '../shared';

const PAGE_SIZE = 20;

/** The status cards: a count per access status, each one a filter. */
const STATUS_CARDS: { status: AccessStatus | null; icon: Icon }[] = [
  { status: null, icon: SquaresFourIcon },
  { status: 'TRIAL', icon: GiftIcon },
  { status: 'PAID', icon: CheckCircleIcon },
  { status: 'INACTIVE', icon: PauseCircleIcon },
  { status: 'SUSPENDED', icon: ProhibitIcon },
];

function accessParam(value: string | null): AccessStatus | undefined {
  return value && value in ACCESS_LABELS ? value as AccessStatus : undefined;
}

/** A steady colour per restaurant for its initial, so the list is easy to scan. */
const AVATAR_TONES = ['teal', 'guava', 'sand', 'sky', 'plum', 'olive'] as const;
function avatarTone(id: string): (typeof AVATAR_TONES)[number] {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

/**
 * Every restaurant on the platform: counts per access status (also the filters), a search by name,
 * address, owner email or phone, and rows that show at a glance who it is, whose it is, its plan and
 * how long it has left.
 */
export function AdminRestaurantsPage() {
  const { text, number } = useLanguage();
  usePageTitle('المطاعم', 'Restaurants');
  const [params, update] = useListParams();
  const access = accessParam(params.get('access'));
  const page = pageParam(params.get('page'));
  const [search, setSearch] = useState(params.get('query') ?? '');
  const debounced = useDebounced(search.trim(), 350);
  // The address bar follows the (debounced) search box.
  useEffect(() => {
    if ((params.get('query') ?? '') !== debounced) update({ query: debounced || null, page: null }, { replace: true });
  }, [debounced]);
  const query = params.get('query') ?? '';
  const restaurants = useRestaurantsQuery({ query: query || undefined, access, page, pageSize: PAGE_SIZE });
  const overview = useAdminOverview();
  const counts = overview.data?.restaurants;
  const searching = restaurants.isFetching || search.trim() !== query;
  const total = restaurants.data?.total;

  return <div className="page admin-restaurants-page">
    <PageHeader title={text('المطاعم', 'Restaurants')}
      description={text('كل المطاعم على المنصة: مين صاحبها، على أنهي باقة، وفاضل لها قد إيه.', 'Every restaurant on the platform: who owns it, which plan it is on, and how long it has left.')} />

    <div className="status-cards" role="group" aria-label={text('فلترة حسب الاشتراك', 'Filter by access')}>
      {STATUS_CARDS.map(({ status, icon: CardIcon }) => {
        const active = access === (status ?? undefined);
        const value = counts ? (status ? counts[status] : counts.total) : null;
        return <button key={status ?? 'all'} type="button" className={`status-card tone-${status ? accessTone(status) : 'all'} ${active ? 'is-active' : ''}`}
          aria-pressed={active} onClick={() => update({ access: status, page: null })} data-testid={`status-${status ?? 'ALL'}`}>
          <span className="status-card-icon" aria-hidden="true"><CardIcon size={20} weight="bold" /></span>
          <span className="status-card-text">
            <span className="status-card-label">{status ? text(...ACCESS_LABELS[status]) : text('كل المطاعم', 'All restaurants')}</span>
            <strong className="status-card-value">{value === null ? <Skeleton width={36} height={22} /> : number(value)}</strong>
          </span>
        </button>;
      })}
    </div>

    <div className="list-toolbar">
      <div className="search-box">
        <MagnifyingGlassIcon size={19} aria-hidden="true" />
        <input className="input" type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={100}
          aria-label={text('ابحث في المطاعم', 'Search restaurants')} placeholder={text('اسم، عنوان، إيميل أو موبايل', 'Name, address, email or phone')} />
        {searching && <span className="spinner search-spinner" aria-hidden="true" />}
        {search && !searching && <button type="button" className="icon-button search-clear" onClick={() => setSearch('')} aria-label={text('امسح البحث', 'Clear search')}><XIcon size={17} /></button>}
      </div>
      {total !== undefined && <p className="list-count" role="status" data-testid="restaurants-count">
        {query || access
          ? text(`${number(total)} نتيجة`, `${total} ${total === 1 ? 'result' : 'results'}`)
          : text(`${number(total)} مطعم`, `${total} restaurants`)}
      </p>}
    </div>

    <section className="card list-card restaurants-card" aria-labelledby="restaurants-title" aria-busy={restaurants.isFetching}>
      <h2 id="restaurants-title" className="visually-hidden">{text('النتائج', 'Results')}</h2>
      {restaurants.isError && <ErrorPanel error={restaurants.error} onRetry={() => void restaurants.refetch()} />}
      {restaurants.isPending && <div className="table-skeleton" role="status" aria-label={text('جاري التحميل', 'Loading')}>{[0, 1, 2, 3, 4].map(index => <Skeleton key={index} height={56} />)}</div>}
      {restaurants.data && restaurants.data.items.length === 0 && <div className="empty-state">
        <span className="empty-state-icon" aria-hidden="true"><StorefrontIcon size={30} /></span>
        <h2>{text('مفيش مطاعم مطابقة', 'No matching restaurants')}</h2>
        <p>{text('جرّب كلمة بحث تانية أو شيل الفلتر.', 'Try another search or clear the filter.')}</p>
        {(query || access) && <button type="button" className="button button-secondary" onClick={() => { setSearch(''); update({ query: null, access: null, page: null }); }}>{text('اعرض كل المطاعم', 'Show all restaurants')}</button>}
      </div>}
      {restaurants.data && restaurants.data.items.length > 0 && <div className="table-scroll">
        <table className="data-table restaurants-table">
          <thead><tr>
            <th scope="col">{text('المطعم', 'Restaurant')}</th>
            <th scope="col">{text('صاحب المطعم', 'Owner')}</th>
            <th scope="col">{text('الباقة', 'Plan')}</th>
            <th scope="col">{text('اتسجل', 'Joined')}</th>
            <th scope="col"><span className="visually-hidden">{text('فتح', 'Open')}</span></th>
          </tr></thead>
          <tbody>{restaurants.data.items.map(row => <RestaurantRow key={row.id} row={row} />)}</tbody>
        </table>
      </div>}
    </section>
    {restaurants.data && <Pagination page={page} pageSize={restaurants.data.pageSize} total={restaurants.data.total} onChange={next => update({ page: next })} label={text('صفحات المطاعم', 'Restaurant pages')} />}
  </div>;
}

function RestaurantRow({ row }: { row: AdminRestaurantRow }) {
  const { text, language, count } = useLanguage();
  const days = accessDaysLeft(row.access);
  const plan = row.access.planCode ? planName(row.access.planCode, text) : null;
  const ending = days !== null && days <= 7;
  const initial = [...row.name.trim()][0]?.toUpperCase() ?? '?';
  return <tr className="restaurant-row" data-testid="restaurant-row">
    <td data-label={text('المطعم', 'Restaurant')} className="cell-primary">
      <div className="restaurant-cell">
        <span className={`restaurant-avatar tone-${avatarTone(row.id)}`} aria-hidden="true">{initial}</span>
        <span className="restaurant-cell-text">
          <Link className="table-link restaurant-open" to={`/admin/restaurants/${row.id}`}><bdi>{row.name}</bdi></Link>
          <span className="restaurant-meta">
            <a className="restaurant-site ltr" href={row.publicUrl} target="_blank" rel="noreferrer"
              aria-label={text(`افتح منيو ${row.name}`, `Open ${row.name}’s menu`)}>{row.subdomain}<ArrowSquareOutIcon size={12} weight="bold" aria-hidden="true" /></a>
            {row.city && <span className="restaurant-city"><bdi>{row.city}</bdi></span>}
          </span>
        </span>
      </div>
    </td>
    <td data-label={text('صاحب المطعم', 'Owner')}>
      <span className="owner-name"><bdi>{row.ownerName}</bdi></span>
      <small className="ltr cell-wrap-anywhere">{row.ownerEmail}</small>
    </td>
    <td data-label={text('الباقة', 'Plan')} className="cell-end">
      <span className="plan-cell">
        <span className={`badge badge-${accessTone(row.access.status)}`}>{text(...ACCESS_LABELS[row.access.status])}</span>
        {plan && <span className="plan-name">{plan}</span>}
      </span>
      {days !== null && <small className={`days-left ${days < 0 ? 'is-over' : ending ? 'is-ending' : ''}`}>
        {days < 0 ? text(`خلص من ${count(-days, 'day')}`, `Ended ${count(-days, 'day')} ago`) : days === 0 ? text('بيخلص النهارده', 'Ends today') : text(`فاضل ${count(days, 'day')}`, `${count(days, 'day')} left`)}
      </small>}
    </td>
    <td data-label={text('اتسجل', 'Joined')} className="cell-nowrap">
      <span title={formatDate(row.createdAt, language)}>{formatRelative(row.createdAt, language)}</span>
      <small>{formatDate(row.createdAt, language)}</small>
    </td>
    <CompactMeta parts={[row.ownerName, text(`اتسجل ${formatRelative(row.createdAt, language)}`, `Joined ${formatRelative(row.createdAt, language)}`)]} />
    <td className="cell-chevron" aria-hidden="true"><CaretRightIcon size={18} weight="bold" className="directional" /></td>
  </tr>;
}

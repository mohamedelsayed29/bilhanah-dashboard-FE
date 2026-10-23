import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { MagnifyingGlassIcon, StorefrontIcon, XIcon } from '@phosphor-icons/react';
import type { AccessStatus } from '@bilhanah/contracts';
import { CompactMeta } from '../../../components/CompactMeta';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Pagination } from '../../../components/Pagination';
import { Skeleton } from '../../../components/Skeleton';
import { formatDate } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useDebounced } from '../../../lib/use-debounced';
import { AccessBadge } from '../../restaurant/access';
import { useRestaurantsQuery } from '../queries';
import { ACCESS_LABELS, pageParam, useListParams } from '../shared';

const FILTERS: (AccessStatus | null)[] = [null, 'TRIAL', 'PAID', 'INACTIVE', 'SUSPENDED'];
const PAGE_SIZE = 20;

function accessParam(value: string | null): AccessStatus | undefined {
  return value && value in ACCESS_LABELS ? value as AccessStatus : undefined;
}

/** Search by name, subdomain, owner email or phone, filtered by access. */
export function AdminRestaurantsPage() {
  const { text, language } = useLanguage();
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
  const searching = restaurants.isFetching || search.trim() !== query;

  return <div className="page">
    <PageHeader title={text('المطاعم', 'Restaurants')} description={text('ابحث بالاسم أو العنوان أو إيميل صاحب المطعم أو رقم الموبايل.', 'Search by name, address, owner email or phone number.')} />
    <div className="list-toolbar">
      <div className="search-box">
        <MagnifyingGlassIcon size={19} aria-hidden="true" />
        <input className="input" type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={100}
          aria-label={text('ابحث في المطاعم', 'Search restaurants')} placeholder={text('اسم، عنوان، إيميل أو موبايل', 'Name, address, email or phone')} />
        {searching && <span className="spinner search-spinner" aria-hidden="true" />}
        {search && !searching && <button type="button" className="icon-button search-clear" onClick={() => setSearch('')} aria-label={text('امسح البحث', 'Clear search')}><XIcon size={17} /></button>}
      </div>
      <div className="filter-chips" role="group" aria-label={text('فلترة حسب الاشتراك', 'Filter by access')}>
        {FILTERS.map(filter => <button key={filter ?? 'all'} type="button" className={`filter-chip ${access === (filter ?? undefined) ? 'active' : ''}`} aria-pressed={access === (filter ?? undefined)}
          onClick={() => update({ access: filter, page: null })}>
          {filter ? text(...ACCESS_LABELS[filter]) : text('الكل', 'All')}
        </button>)}
      </div>
    </div>
    <section className="card list-card" aria-labelledby="restaurants-title" aria-busy={restaurants.isFetching}>
      <h2 id="restaurants-title" className="visually-hidden">{text('النتائج', 'Results')}</h2>
      {restaurants.isError && <ErrorPanel error={restaurants.error} onRetry={() => void restaurants.refetch()} />}
      {restaurants.isPending && <div className="table-skeleton" role="status" aria-label={text('جاري التحميل', 'Loading')}>{[0, 1, 2, 3, 4].map(index => <Skeleton key={index} height={44} />)}</div>}
      {restaurants.data && restaurants.data.items.length === 0 && <div className="empty-state">
        <span className="empty-state-icon" aria-hidden="true"><StorefrontIcon size={30} /></span>
        <h2>{text('مفيش مطاعم مطابقة', 'No matching restaurants')}</h2>
        <p>{text('جرّب كلمة بحث تانية أو شيل الفلتر.', 'Try another search or clear the filter.')}</p>
      </div>}
      {restaurants.data && restaurants.data.items.length > 0 && <div className="table-scroll">
        <table className="data-table">
          <thead><tr>
            <th scope="col">{text('المطعم', 'Restaurant')}</th>
            <th scope="col">{text('صاحب المطعم', 'Owner')}</th>
            <th scope="col">{text('المدينة', 'City')}</th>
            <th scope="col">{text('الاشتراك', 'Access')}</th>
            <th scope="col">{text('اتسجل', 'Joined')}</th>
          </tr></thead>
          <tbody>
            {restaurants.data.items.map(row => <tr key={row.id} data-testid="restaurant-row">
              <td data-label={text('المطعم', 'Restaurant')} className="cell-primary">
                <Link className="table-link row-link" to={`/admin/restaurants/${row.id}`}><bdi>{row.name}</bdi></Link>
                <small className="ltr">{row.subdomain}</small>
              </td>
              <td data-label={text('صاحب المطعم', 'Owner')}>{row.ownerName}<small className="ltr cell-wrap-anywhere">{row.ownerEmail}</small></td>
              <td data-label={text('المدينة', 'City')}>{row.city}</td>
              <td data-label={text('الاشتراك', 'Access')} className="cell-end"><AccessBadge access={row.access} short /></td>
              <td data-label={text('اتسجل', 'Joined')} className="cell-nowrap">{formatDate(row.createdAt, language)}</td>
              <CompactMeta parts={[row.city, text(`اتسجل ${formatDate(row.createdAt, language)}`, `Joined ${formatDate(row.createdAt, language)}`)]} />
            </tr>)}
          </tbody>
        </table>
      </div>}
    </section>
    {restaurants.data && <Pagination page={page} pageSize={restaurants.data.pageSize} total={restaurants.data.total} onChange={next => update({ page: next })} label={text('صفحات المطاعم', 'Restaurant pages')} />}
  </div>;
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { MagnifyingGlassIcon, PackageIcon, XIcon } from '@phosphor-icons/react';
import { CompactMeta } from '../../../components/CompactMeta';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Pagination } from '../../../components/Pagination';
import { Skeleton } from '../../../components/Skeleton';
import { formatDate, formatPrice } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useDebounced } from '../../../lib/use-debounced';
import { useAdminOverview, useStandOrdersQuery } from '../queries';
import { pageParam, useListParams } from '../shared';
import { StandPaymentBadge, StandStatusBadge } from './StandOrderBadges';
import { filterName, filterParam, STAND_FILTERS, standCount } from './stand-orders';

const PAGE_SIZE = 25;

/** The stand-shop fulfilment queue: open orders by default, newest first, searchable. */
export function AdminStandOrdersPage() {
  const { text, number, count, language } = useLanguage();
  usePageTitle('طلبات الستاندات', 'Stand orders');
  const [params, update] = useListParams();
  const filter = filterParam(params.get('status'));
  const page = pageParam(params.get('page'));
  const [search, setSearch] = useState(params.get('query') ?? '');
  const debounced = useDebounced(search.trim(), 350);
  useEffect(() => {
    if ((params.get('query') ?? '') !== debounced) update({ query: debounced || null, page: null }, { replace: true });
  }, [debounced]);
  const query = params.get('query') ?? '';
  const orders = useStandOrdersQuery({ status: filter === 'all' ? undefined : filter, query: query || undefined, page, pageSize: PAGE_SIZE });
  const fresh = useAdminOverview().data?.newStandOrders ?? 0;
  const searching = orders.isFetching || search.trim() !== query;

  return <div className="page">
    <PageHeader title={text('طلبات الستاندات', 'Stand orders')}
      description={text('طلبات ستاندات QR وNFC من الموقع. كلّم العميل وأكّد الطلب، وبعدين تابعه لحد ما يتسلّم.',
        'QR and NFC stand orders from the website. Call the customer to confirm, then follow each order through to delivery.')} />
    <div className="list-toolbar">
      <div className="search-box">
        <MagnifyingGlassIcon size={19} aria-hidden="true" />
        <input className="input" type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={100}
          aria-label={text('ابحث في طلبات الستاندات', 'Search stand orders')} placeholder={text('رقم الطلب، الاسم، الموبايل أو الإيميل', 'Reference, name, phone or email')} />
        {searching && <span className="spinner search-spinner" aria-hidden="true" />}
        {search && !searching && <button type="button" className="icon-button search-clear" onClick={() => setSearch('')} aria-label={text('امسح البحث', 'Clear search')}><XIcon size={17} /></button>}
      </div>
    </div>
    <div className="filter-chips" role="group" aria-label={text('فلترة حسب الحالة', 'Filter by status')}>
      {STAND_FILTERS.map(entry => <button key={entry} type="button" className={`filter-chip ${filter === entry ? 'active' : ''}`} aria-pressed={filter === entry}
        onClick={() => update({ status: entry === 'open' ? null : entry, page: null })}>
        {filterName(entry, text)}
        {entry === 'NEW' && fresh > 0 && <span className="tab-count" aria-hidden="true">{number(fresh)}</span>}
      </button>)}
    </div>
    <section className="card list-card" aria-labelledby="stand-orders-title" aria-busy={orders.isFetching}>
      <h2 id="stand-orders-title" className="visually-hidden">{text(`الطلبات: ${filterName(filter, text)}`, `Orders: ${filterName(filter, text)}`)}</h2>
      {orders.isError && <ErrorPanel error={orders.error} onRetry={() => void orders.refetch()} />}
      {orders.isPending && <div className="table-skeleton" role="status" aria-label={text('جاري التحميل', 'Loading')}>{[0, 1, 2, 3].map(index => <Skeleton key={index} height={44} />)}</div>}
      {orders.data && orders.data.items.length === 0 && <div className="empty-state" data-testid="stand-orders-empty">
        <span className="empty-state-icon" aria-hidden="true">{query ? <MagnifyingGlassIcon size={30} /> : <PackageIcon size={30} />}</span>
        <h2>{query ? text('مفيش طلبات مطابقة', 'No matching orders') : filter === 'open' ? text('مفيش طلبات مفتوحة', 'No open orders') : text('مفيش طلبات هنا', 'No orders here')}</h2>
        <p>{query ? text('جرّب كلمة بحث تانية أو غيّر الفلتر.', 'Try another search or change the filter.') : text('أول ما حد يطلب ستاند من الموقع هيظهر هنا.', 'New orders from the website appear here.')}</p>
      </div>}
      {orders.data && orders.data.items.length > 0 && <div className="table-scroll">
        <table className="data-table">
          <thead><tr>
            <th scope="col">{text('الطلب', 'Order')}</th>
            <th scope="col">{text('العميل', 'Customer')}</th>
            <th scope="col">{text('الستاندات', 'Stands')}</th>
            <th scope="col">{text('الإجمالي', 'Total')}</th>
            <th scope="col">{text('الدفع', 'Payment')}</th>
            <th scope="col">{text('الحالة', 'Status')}</th>
            <th scope="col"><span className="visually-hidden">{text('إجراءات', 'Actions')}</span></th>
          </tr></thead>
          <tbody>
            {orders.data.items.map(order => <tr key={order.id} data-testid="stand-order-row" data-status={order.status}>
              <td data-label={text('الطلب', 'Order')} className="cell-primary">
                <Link className="table-link row-link ltr" to={`/admin/stand-orders/${order.id}`}>{order.reference}</Link>
                <small>{formatDate(order.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</small>
              </td>
              <td data-label={text('العميل', 'Customer')}><bdi>{order.customerName}</bdi><small>{order.city} · <span className="ltr">{order.phone}</span></small></td>
              <td data-label={text('الستاندات', 'Stands')} className="cell-nowrap">{count(standCount(order), 'stand')}
                <small>{count(order.lines.length, 'design')}</small></td>
              <td data-label={text('الإجمالي', 'Total')} className="cell-amount">{formatPrice(order.totalPiastres, language)}
                {order.deliveryFeePiastres === null && <small>{text('+ التوصيل بالتليفون', '+ delivery by phone')}</small>}</td>
              <td data-label={text('الدفع', 'Payment')}><StandPaymentBadge order={order} /></td>
              <td data-label={text('الحالة', 'Status')} className="cell-end"><StandStatusBadge status={order.status} /></td>
              <CompactMeta parts={[<bdi>{order.customerName}</bdi>, order.city, `${count(standCount(order), 'stand')}${text('، ', ', ')}${formatPrice(order.totalPiastres, language)}`, <StandPaymentBadge order={order} />]} />
              <td className="cell-action desktop-only">
                <Link className={`button button-small ${order.status === 'NEW' ? 'button-primary' : 'button-secondary'}`} to={`/admin/stand-orders/${order.id}`}
                  aria-label={order.status === 'NEW' ? text(`تابع الطلب ${order.reference}`, `Handle order ${order.reference}`) : text(`التفاصيل، طلب ${order.reference}`, `Details, order ${order.reference}`)}>
                  {order.status === 'NEW' ? text('تابع الطلب', 'Handle') : text('التفاصيل', 'Details')}
                </Link>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    </section>
    {orders.data && <Pagination page={page} pageSize={orders.data.pageSize} total={orders.data.total} onChange={next => update({ page: next })} label={text('صفحات الطلبات', 'Order pages')} />}
  </div>;
}

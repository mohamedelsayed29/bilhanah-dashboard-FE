import { Link } from 'react-router';
import { CheckCircleIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import type { PaymentStatus } from '@bilhanah/contracts';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Pagination } from '../../../components/Pagination';
import { Skeleton } from '../../../components/Skeleton';
import { formatDate, formatPrice } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { isReviewable, methodName, monthsLabel, PaymentStatusBadge, planName } from '../../billing/labels';
import { useAdminOverview, usePaymentsQuery } from '../queries';
import { pageParam, useListParams } from '../shared';
import { PaymentDialog } from './PaymentDialog';

/** The statuses the admin list can filter by (online payments in progress or declined appear under "All"). */
type Tab = Extract<PaymentStatus, 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'> | 'ALL';
const TABS: { value: Tab; ar: string; en: string }[] = [
  { value: 'PENDING', ar: 'مستني المراجعة', en: 'Pending' },
  { value: 'APPROVED', ar: 'اتقبل', en: 'Approved' },
  { value: 'REJECTED', ar: 'اترفض', en: 'Rejected' },
  { value: 'CANCELLED', ar: 'اتسحب أو اتلغى', en: 'Cancelled' },
  { value: 'ALL', ar: 'الكل', en: 'All' },
];

function tabParam(value: string | null): Tab {
  return TABS.find(entry => entry.value === value)?.value ?? 'PENDING';
}

/** The review queue (oldest pending first) and every other payment by status. */
export function AdminPaymentsPage() {
  const { text, number, language } = useLanguage();
  usePageTitle('التحويلات', 'Payments');
  const [params, update] = useListParams();
  const tab = tabParam(params.get('status'));
  const page = pageParam(params.get('page'));
  const viewing = params.get('view');
  const payments = usePaymentsQuery(tab === 'ALL' ? undefined : tab, page);
  const pending = useAdminOverview().data?.pendingPayments ?? 0;
  const current = TABS.find(entry => entry.value === tab)!;

  return <div className="page">
    <PageHeader title={text('التحويلات', 'Payments')}
      description={text('راجع التحويلات اللي أصحاب المطاعم بعتوها، وطابقها مع حساباتك قبل ما تقبلها.', 'Review the transfers owners have sent and match them against your accounts before approving.')} />
    <nav className="tabs" aria-label={text('فلترة حسب الحالة', 'Filter by status')}>
      {TABS.map(entry => <button key={entry.value} type="button" className={`tab ${tab === entry.value ? 'active' : ''}`} aria-pressed={tab === entry.value}
        onClick={() => update({ status: entry.value === 'PENDING' ? null : entry.value, page: null })}>
        {text(entry.ar, entry.en)}
        {entry.value === 'PENDING' && pending > 0 && <span className="tab-count" aria-hidden="true">{number(pending)}</span>}
      </button>)}
    </nav>
    <section className="card list-card" aria-labelledby="payments-title" aria-busy={payments.isFetching}>
      <h2 id="payments-title" className="visually-hidden">{text(current.ar, current.en)}</h2>
      {payments.isError && <ErrorPanel error={payments.error} onRetry={() => void payments.refetch()} />}
      {payments.isPending && <div className="table-skeleton" role="status" aria-label={text('جاري التحميل', 'Loading')}>{[0, 1, 2, 3].map(index => <Skeleton key={index} height={44} />)}</div>}
      {payments.data && payments.data.items.length === 0 && <div className="empty-state">
        <span className="empty-state-icon" aria-hidden="true">{tab === 'PENDING' ? <CheckCircleIcon size={30} /> : <MagnifyingGlassIcon size={30} />}</span>
        <h2>{tab === 'PENDING' ? text('مفيش تحويلات مستنية', 'Nothing waiting for review') : text('مفيش تحويلات هنا', 'No payments here')}</h2>
        <p>{tab === 'PENDING' ? text('أول ما صاحب مطعم يبعت تحويل هيظهر هنا، وهيوصلك إيميل.', 'New transfers appear here as owners send them, and you are emailed.') : text('مفيش تحويلات بالحالة دي لسه.', 'There are no payments with this status yet.')}</p>
      </div>}
      {payments.data && payments.data.items.length > 0 && <div className="table-scroll">
        <table className="data-table">
          <thead><tr>
            <th scope="col">{text('المطعم', 'Restaurant')}</th>
            <th scope="col">{text('الباقة', 'Plan')}</th>
            <th scope="col">{text('المبلغ', 'Amount')}</th>
            <th scope="col">{text('الطريقة', 'Method')}</th>
            <th scope="col">{text('رقم العملية', 'Reference')}</th>
            <th scope="col">{text('المحوّل', 'Payer')}</th>
            <th scope="col">{text('اتبعت', 'Submitted')}</th>
            {tab !== 'PENDING' && <th scope="col">{text('الحالة', 'Status')}</th>}
            <th scope="col"><span className="visually-hidden">{text('إجراءات', 'Actions')}</span></th>
          </tr></thead>
          <tbody>
            {payments.data.items.map(payment => <tr key={payment.id} data-testid="payment-queue-row">
              <td data-label={text('المطعم', 'Restaurant')} className="cell-primary">
                <Link className="table-link" to={`/admin/restaurants/${payment.restaurant.id}`}>{payment.restaurant.name}</Link>
                <small className="ltr">{payment.restaurant.subdomain}</small>
              </td>
              <td data-label={text('الباقة', 'Plan')}>{planName(payment.planCode, text)}<small>{monthsLabel(payment.months, text, number)}</small></td>
              <td data-label={text('المبلغ', 'Amount')} className="cell-amount">{formatPrice(payment.amountPiastres, language)}</td>
              <td data-label={text('الطريقة', 'Method')}>{methodName(payment.method, text)}</td>
              <td data-label={text('رقم العملية', 'Reference')}><span className="ltr cell-mono">{payment.reference}</span></td>
              <td data-label={text('المحوّل', 'Payer')}>{payment.payerName ?? <span className="muted">—</span>}</td>
              <td data-label={text('اتبعت', 'Submitted')}>{formatDate(payment.createdAt, language, { dateStyle: 'medium' })}<small>{formatDate(payment.createdAt, language, { timeStyle: 'short' })}</small></td>
              {tab !== 'PENDING' && <td data-label={text('الحالة', 'Status')}><PaymentStatusBadge status={payment.status} method={payment.method} /></td>}
              <td className="cell-action">
                <button type="button" className={`button button-small ${isReviewable(payment) ? 'button-primary' : 'button-secondary'}`} onClick={() => update({ view: payment.id })}
                  aria-label={isReviewable(payment) ? text(`راجع تحويل ${payment.restaurant.name}`, `Review the payment from ${payment.restaurant.name}`) : text(`التفاصيل، دفع ${payment.restaurant.name}`, `Details of the payment from ${payment.restaurant.name}`)}>
                  {isReviewable(payment) ? text('راجع', 'Review') : text('التفاصيل', 'Details')}
                </button>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    </section>
    {payments.data && <Pagination page={page} pageSize={payments.data.pageSize} total={payments.data.total} onChange={next => update({ page: next })} label={text('صفحات التحويلات', 'Payment pages')} />}
    <PaymentDialog paymentId={viewing} onClose={() => update({ view: null })} />
  </div>;
}

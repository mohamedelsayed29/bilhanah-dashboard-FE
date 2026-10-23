import { Link } from 'react-router';
import { ClipboardTextIcon } from '@phosphor-icons/react';
import type { AuditEntry } from '@bilhanah/contracts';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Pagination } from '../../../components/Pagination';
import { Skeleton } from '../../../components/Skeleton';
import { formatDate } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { planName } from '../../billing/labels';
import { useAuditQuery } from '../queries';
import { pageParam, useListParams } from '../shared';
import { auditActionLabel, auditDetails, auditTarget, auditTone } from './audit-labels';

/** Who did what in the admin console, newest first. */
export function AdminAuditPage() {
  const { text, language } = useLanguage();
  usePageTitle('سجل المراجعة', 'Audit log');
  const [params, update] = useListParams();
  const page = pageParam(params.get('page'));
  const audit = useAuditQuery(page);
  return <div className="page">
    <PageHeader title={text('سجل المراجعة', 'Audit log')} description={text('كل تغيير اتعمل من لوحة الإدارة، مين عمله وإمتى. الأحدث الأول.', 'Every change made in the admin console, who made it and when. Newest first.')} />
    <section className="card list-card" aria-labelledby="audit-title" aria-busy={audit.isFetching}>
      <h2 id="audit-title" className="visually-hidden">{text('التغييرات', 'Changes')}</h2>
      {audit.isError && <ErrorPanel error={audit.error} onRetry={() => void audit.refetch()} />}
      {audit.isPending && <div className="table-skeleton" role="status" aria-label={text('جاري التحميل', 'Loading')}>{[0, 1, 2, 3, 4].map(index => <Skeleton key={index} height={44} />)}</div>}
      {audit.data && audit.data.items.length === 0 && <div className="empty-state">
        <span className="empty-state-icon" aria-hidden="true"><ClipboardTextIcon size={30} /></span>
        <h2>{text('السجل فاضي', 'Nothing recorded yet')}</h2>
        <p>{text('أي تغيير من لوحة الإدارة هيتسجل هنا.', 'Changes made in the admin console appear here.')}</p>
      </div>}
      {audit.data && audit.data.items.length > 0 && <div className="table-scroll">
        <table className="data-table audit-table">
          <thead><tr>
            <th scope="col">{text('الوقت', 'Time')}</th>
            <th scope="col">{text('مين', 'Who')}</th>
            <th scope="col">{text('العملية', 'Action')}</th>
            <th scope="col">{text('على', 'Target')}</th>
            <th scope="col">{text('التفاصيل', 'Details')}</th>
          </tr></thead>
          <tbody>
            {audit.data.items.map(entry => {
              const details = auditDetails(entry, text, language);
              return <tr key={entry.id} data-testid="audit-row" data-action={entry.action}>
                <td data-label={text('الوقت', 'Time')} className="cell-nowrap">{formatDate(entry.createdAt, language, { dateStyle: 'medium' })}<small>{formatDate(entry.createdAt, language, { timeStyle: 'short' })}</small></td>
                <td data-label={text('مين', 'Who')}>{entry.actor ? <>{entry.actor.name}<small className="ltr">{entry.actor.email}</small></> : <span className="muted">{text('النظام', 'System')}</span>}</td>
                <td data-label={text('العملية', 'Action')}><span className={`badge ${auditTone(entry.action) === 'default' ? '' : `badge-${auditTone(entry.action)}`}`}>{auditActionLabel(entry.action, text)}</span></td>
                <td data-label={text('على', 'Target')}><Target entry={entry} /></td>
                <td data-label={text('التفاصيل', 'Details')} className="cell-wide">
                  <div className="cell-details">
                    {details.length ? details.map(line => <span key={line} className="detail-line">{line}</span>) : <span className="muted">—</span>}
                    {entry.ipAddress && <small className="ltr">IP {entry.ipAddress}</small>}
                  </div>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>}
    </section>
    {audit.data && <Pagination page={page} pageSize={audit.data.pageSize} total={audit.data.total} onChange={next => update({ page: next })} label={text('صفحات السجل', 'Audit log pages')} />}
  </div>;
}

function Target({ entry }: { entry: AuditEntry }) {
  const { text } = useLanguage();
  const target = auditTarget(entry);
  switch (target.kind) {
    case 'restaurant':
      return <Link className="table-link" to={`/admin/restaurants/${target.id}`}>{text('المطعم', 'Restaurant')}<small className="ltr">{target.id.slice(0, 8)}</small></Link>;
    case 'payment':
      return <span className="target-links">
        <Link className="table-link" to={`/admin/payments?status=ALL&view=${target.id}`}>{text('التحويل', 'Payment')}<small className="ltr">{target.id.slice(0, 8)}</small></Link>
        {target.restaurantId && <Link className="link small" to={`/admin/restaurants/${target.restaurantId}`}>{text('المطعم', 'Restaurant')}</Link>}
      </span>;
    case 'plan':
      return <span>{text('باقة', 'Plan')} {planName(target.code, text)}</span>;
    case 'settings':
      return <Link className="table-link" to="/admin/settings">{text('الإعدادات', 'Settings')}</Link>;
    default:
      return <span className="ltr">{target.label}</span>;
  }
}

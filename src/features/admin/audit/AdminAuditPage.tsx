import { Fragment } from 'react';
import { Link } from 'react-router';
import { ClipboardTextIcon, CreditCardIcon, GearSixIcon, PackageIcon, RobotIcon, StorefrontIcon, UsersThreeIcon, WarningIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { AUDIT_SCOPES, type AuditEntry, type AuditScope } from '@bilhanah/contracts';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Pagination } from '../../../components/Pagination';
import { Skeleton } from '../../../components/Skeleton';
import { formatDate, formatRelative } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { planName } from '../../billing/labels';
import { useAuditQuery } from '../queries';
import { pageParam, useListParams } from '../shared';
import { type AuditCategory, auditCategory, auditDetails, auditSubject, auditTarget, auditTone, auditVerb } from './audit-labels';

const CATEGORY_ICONS: Record<AuditCategory, Icon> = {
  restaurant: StorefrontIcon, payment: CreditCardIcon, settings: GearSixIcon, staff: UsersThreeIcon, shop: PackageIcon, alert: WarningIcon,
};

const SCOPE_TEXT: Record<AuditScope | 'all', [ar: string, en: string]> = {
  all: ['الكل', 'Everything'],
  platform: ['لوحة الإدارة', 'Admin console'],
  restaurant: ['المطاعم', 'Restaurants'],
};

function scopeParam(value: string | null): AuditScope | undefined {
  return value && (AUDIT_SCOPES as readonly string[]).includes(value) ? value as AuditScope : undefined;
}

/** The viewer's local day of an entry, for grouping. */
const dayKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/**
 * Who changed what, newest first, read as sentences ("Mona suspended Koshary") grouped by day. Each
 * entry carries an icon for what it is about, its details as short facts, and who and from where
 * in small print. Changes made in the console and those restaurants made themselves can be split.
 */
export function AdminAuditPage() {
  const { text, language } = useLanguage();
  usePageTitle('سجل المراجعة', 'Audit log');
  const [params, update] = useListParams();
  const page = pageParam(params.get('page'));
  const scope = scopeParam(params.get('scope'));
  const audit = useAuditQuery(page, scope);
  const dayLabel = (iso: string) => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    if (dayKey(iso) === dayKey(today.toISOString())) return text('النهارده', 'Today');
    if (dayKey(iso) === dayKey(yesterday.toISOString())) return text('امبارح', 'Yesterday');
    return formatDate(iso, language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const items = audit.data?.items ?? [];

  return <div className="page audit-page">
    <PageHeader title={text('سجل المراجعة', 'Audit log')}
      description={text('كل تغيير مهم على المنصة: مين عمله، على إيه، وإمتى. الأحدث الأول.', 'Every important change on the platform: who made it, to what, and when. Newest first.')} />

    <div className="list-toolbar">
      <div className="segmented audit-scope" role="radiogroup" aria-label={text('نوع التغييرات', 'Kind of changes')}>
        {(['all', ...AUDIT_SCOPES] as const).map(value => <label key={value}>
          <input type="radio" name="audit-scope" checked={(scope ?? 'all') === value} onChange={() => update({ scope: value === 'all' ? null : value, page: null })} />
          {text(...SCOPE_TEXT[value])}
        </label>)}
      </div>
      {audit.data && <p className="list-count" role="status">{text(`${audit.data.total.toLocaleString('ar-EG')} تغيير`, `${audit.data.total.toLocaleString('en')} changes`)}</p>}
    </div>

    <section className="card audit-card" aria-labelledby="audit-title" aria-busy={audit.isFetching}>
      <h2 id="audit-title" className="visually-hidden">{text('التغييرات', 'Changes')}</h2>
      {audit.isError && <ErrorPanel error={audit.error} onRetry={() => void audit.refetch()} />}
      {audit.isPending && <div className="audit-skeleton" role="status" aria-label={text('جاري التحميل', 'Loading')}>{[0, 1, 2, 3, 4].map(index => <Skeleton key={index} height={64} />)}</div>}
      {audit.data && items.length === 0 && <div className="empty-state">
        <span className="empty-state-icon" aria-hidden="true"><ClipboardTextIcon size={30} /></span>
        <h2>{text('السجل فاضي', 'Nothing recorded yet')}</h2>
        <p>{scope === 'restaurant'
          ? text('تغييرات المطاعم في حسابات موظفيها هتظهر هنا.', 'Restaurants’ changes to their staff accounts appear here.')
          : text('أي تغيير من لوحة الإدارة هيتسجل هنا.', 'Changes made in the admin console appear here.')}</p>
      </div>}
      {items.length > 0 && <ol className="audit-timeline">
        {items.map((entry, index) => {
          const newDay = index === 0 || dayKey(entry.createdAt) !== dayKey(items[index - 1]!.createdAt);
          return <Fragment key={entry.id}>
            {newDay && <li className="audit-day" aria-hidden="true"><span>{dayLabel(entry.createdAt)}</span></li>}
            <AuditItem entry={entry} />
          </Fragment>;
        })}
      </ol>}
    </section>
    {audit.data && <Pagination page={page} pageSize={audit.data.pageSize} total={audit.data.total} onChange={next => update({ page: next })} label={text('صفحات السجل', 'Audit log pages')} />}
  </div>;
}

function AuditItem({ entry }: { entry: AuditEntry }) {
  const { text, language } = useLanguage();
  const category = auditCategory(entry.action);
  const CategoryIcon = CATEGORY_ICONS[category];
  const details = auditDetails(entry, text, language);
  const subject = auditSubject(entry);
  const tone = auditTone(entry.action);
  return <li className={`audit-item tone-${tone}`} data-testid="audit-row" data-action={entry.action}>
    <span className={`audit-icon category-${category}`} aria-hidden="true"><CategoryIcon size={19} weight="bold" /></span>
    <div className="audit-body">
      <p className="audit-sentence">
        {entry.actor
          ? <strong className="audit-actor"><bdi>{entry.actor.name}</bdi></strong>
          : <strong className="audit-actor is-system"><RobotIcon size={15} weight="bold" aria-hidden="true" />{text('الدفع الأونلاين', 'Online payments')}</strong>}
        {' '}{auditVerb(entry.action, text)}{' '}
        {subject && <strong><bdi>{subject}</bdi></strong>}
        <Target entry={entry} withSubject={Boolean(subject)} />
      </p>
      {details.length > 0 && <ul className="audit-facts">{details.map(line => <li key={line}><bdi>{line}</bdi></li>)}</ul>}
      <p className="audit-meta">
        {entry.scope === 'restaurant' && <span className="audit-origin">{text('من لوحة المطعم', 'From the restaurant’s dashboard')}</span>}
        {entry.actor && <span className="ltr">{entry.actor.email}</span>}
        {entry.ipAddress && <span className="ltr">IP {entry.ipAddress.replace(/^::ffff:/, '')}</span>}
      </p>
    </div>
    <time className="audit-time" dateTime={entry.createdAt} title={formatDate(entry.createdAt, language, { dateStyle: 'full', timeStyle: 'short' })}>
      <span>{formatDate(entry.createdAt, language, { timeStyle: 'short' })}</span>
      <small>{formatRelative(entry.createdAt, language)}</small>
    </time>
  </li>;
}

/** The object of the sentence: the restaurant (linked), the plan, the stand order… */
function Target({ entry, withSubject }: { entry: AuditEntry; withSubject: boolean }) {
  const { text } = useLanguage();
  const target = auditTarget(entry);
  const restaurant = entry.restaurant
    ? <Link className="audit-link" to={`/admin/restaurants/${entry.restaurant.id}`}><bdi>{entry.restaurant.name}</bdi></Link>
    : null;
  switch (target.kind) {
    case 'restaurant':
      return restaurant ?? <Link className="audit-link" to={`/admin/restaurants/${target.id}`}>{text('مطعم', 'a restaurant')}</Link>;
    case 'payment':
      return <>{restaurant ?? (target.restaurantId ? <Link className="audit-link" to={`/admin/restaurants/${target.restaurantId}`}>{text('مطعم', 'a restaurant')}</Link> : null)}
        {' '}<Link className="audit-chip-link" to={`/admin/payments?status=ALL&view=${target.id}`}>{text('افتح التحويل', 'Open payment')}</Link></>;
    case 'plan':
      return <strong>{text(`باقة ${planName(target.code, text)}`, `the ${planName(target.code, text)} plan`)}</strong>;
    case 'settings':
      return <Link className="audit-chip-link" to={target.section === 'payment' ? '/admin/settings' : `/admin/settings/${target.section}`}>{text('افتح الإعدادات', 'Open settings')}</Link>;
    case 'stand-order':
      return <Link className="audit-chip-link" to={`/admin/stand-orders/${target.id}`}>{text('افتح الطلب', 'Open order')}</Link>;
    case 'staff':
      return restaurant ? <>{withSubject ? text(' في ', ' at ') : ''}{restaurant}</> : null;
    default:
      return <span className="muted ltr">{target.label}</span>;
  }
}

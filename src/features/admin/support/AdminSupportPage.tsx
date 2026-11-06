import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellIcon, BookOpenTextIcon, CaretLeftIcon, CaretRightIcon, ChatsCircleIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { AGENT_PAGE_SIZES, AGENT_TICKET_VIEWS, type AgentTicketView, TICKET_PRIORITIES, type TicketPriority, type TicketStatus } from '@bilhanah/contracts';
import { Button } from '../../../components/Button';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { supportApi } from '../../../lib/api/endpoints';
import { formatDate, formatRelative } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useDebounced } from '../../../lib/use-debounced';
import { pageParam, useListParams } from '../shared';
import { NOTIFICATION_LABELS, pageWindow, PRIORITY_LABELS, STATUS_LABELS, TOPIC_LABELS, VIEW_LABELS } from './labels';

export const supportKeys = {
  all: ['admin', 'support'] as const,
  notifications: ['admin', 'support', 'notifications'] as const,
  agents: ['admin', 'support', 'agents'] as const,
  ticket: (id: string) => ['admin', 'support', 'ticket', id] as const,
};

/** Unread support notifications, for the navigation badge and the inbox; refreshed on its own. */
export function useSupportNotifications() {
  return useQuery({ queryKey: supportKeys.notifications, queryFn: supportApi.notifications, refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 0 });
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { text } = useLanguage();
  return <span className={`ticket-status is-${status.toLowerCase().replace(/_/g, '-')}`} data-testid="ticket-status">{text(...STATUS_LABELS[status])}</span>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const { text } = useLanguage();
  return <span className={`ticket-priority is-${priority.toLowerCase()}`}>{text(...PRIORITY_LABELS[priority])}</span>;
}

/** The support inbox: every restaurant's tickets by status or assignment, searchable, with the agent's notifications. */
export function AdminSupportPage() {
  const { text, number, language } = useLanguage();
  usePageTitle('الدعم الفني', 'Support');
  const queryClient = useQueryClient();
  const [params, update] = useListParams();
  const view = (AGENT_TICKET_VIEWS as readonly string[]).includes(params.get('view') ?? '') ? params.get('view') as AgentTicketView : 'ALL';
  const priority = (TICKET_PRIORITIES as readonly string[]).includes(params.get('priority') ?? '') ? params.get('priority') as TicketPriority : undefined;
  const page = pageParam(params.get('page'));
  const pageSize = (AGENT_PAGE_SIZES as readonly number[]).includes(Number(params.get('size'))) ? Number(params.get('size')) : AGENT_PAGE_SIZES[0];
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debounced = useDebounced(search.trim(), 350);
  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced) update({ q: debounced || null, page: null }, { replace: true });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = params.get('q') ?? '';
  const tickets = useQuery({
    queryKey: [...supportKeys.all, 'tickets', view, q, priority ?? '', page, pageSize],
    queryFn: ({ signal }) => supportApi.tickets({ view, q: q || undefined, priority, page, pageSize }, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    staleTime: 0,
  });
  const notifications = useSupportNotifications();
  const unread = (notifications.data?.items ?? []).filter(item => !item.read);
  const readAll = useMutation({
    mutationFn: () => supportApi.markRead({ all: true }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: supportKeys.notifications }),
  });

  return <div className="page support-inbox">
    <PageHeader title={text('الدعم الفني', 'Support')}
      description={text('تذاكر المطاعم لفريق بالهنا: رد على العملاء، اكتب ملاحظات داخلية، وعيّن كل تذكرة لحد يتابعها.', 'Restaurant tickets for the Bilhanah team: reply to customers, keep internal notes, and assign each ticket to someone.')}
      actions={<Link className="button button-secondary" to="/admin/support/faq"><BookOpenTextIcon size={18} aria-hidden="true" />{text('الأسئلة الشائعة', 'FAQ content')}</Link>} />

    {unread.length > 0 && <section className="card support-alerts" aria-labelledby="support-alerts-title">
      <div className="support-alerts-head">
        <h2 id="support-alerts-title"><BellIcon size={18} aria-hidden="true" />{text(`${number(unread.length)} تنبيه جديد`, `${unread.length} new notifications`)}</h2>
        <Button small variant="ghost" loading={readAll.isPending} onClick={() => readAll.mutate()}>{text('علّمهم مقروءين', 'Mark all read')}</Button>
      </div>
      <ul>
        {unread.slice(0, 6).map(item => <li key={item.id}>
          <Link to={`/admin/support/${item.ticketId}`} data-testid="support-alert">
            <span className={`support-alert-kind is-${item.kind.toLowerCase().replace(/_/g, '-')}`}>{text(...NOTIFICATION_LABELS[item.kind])}{item.count > 1 && <span> ×{number(item.count)}</span>}</span>
            <span className="ltr support-ref">{item.reference}</span>
            <bdi className="support-alert-subject">{item.subject}</bdi>
            {item.restaurantName && <small><bdi>{item.restaurantName}</bdi></small>}
            <small className="support-alert-time">{formatRelative(item.updatedAt, language)}</small>
          </Link>
        </li>)}
      </ul>
    </section>}

    <div className="list-toolbar">
      <div className="search-box">
        <MagnifyingGlassIcon size={19} aria-hidden="true" />
        <input className="input" type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={120}
          aria-label={text('ابحث في التذاكر', 'Search tickets')} placeholder={text('BIL-10482، الموضوع، المطعم أو إيميل العميل', 'BIL-10482, subject, restaurant or customer email')} />
        {search && <button type="button" className="icon-button search-clear" onClick={() => setSearch('')} aria-label={text('امسح البحث', 'Clear search')}><XIcon size={17} /></button>}
      </div>
      <select className="select support-priority-filter" value={priority ?? ''} onChange={event => update({ priority: event.target.value || null, page: null })} aria-label={text('الأهمية', 'Priority')}>
        <option value="">{text('كل الأهميات', 'Any priority')}</option>
        {TICKET_PRIORITIES.map(value => <option key={value} value={value}>{text(...PRIORITY_LABELS[value])}</option>)}
      </select>
    </div>
    <div className="filter-chips" role="group" aria-label={text('فلترة التذاكر', 'Filter tickets')}>
      {AGENT_TICKET_VIEWS.map(entry => <button key={entry} type="button" className={`filter-chip ${view === entry ? 'active' : ''}`} aria-pressed={view === entry}
        onClick={() => update({ view: entry === 'ALL' ? null : entry, page: null })} data-testid={`view-${entry}`}>
        {text(...VIEW_LABELS[entry])}
        {tickets.data && <span className="tab-count">{number(tickets.data.counts[entry])}</span>}
      </button>)}
    </div>

    <section className="card list-card" aria-labelledby="tickets-title" aria-busy={tickets.isFetching}>
      <h2 id="tickets-title" className="visually-hidden">{text(...VIEW_LABELS[view])}</h2>
      {tickets.isError && <ErrorPanel error={tickets.error} onRetry={() => void tickets.refetch()} />}
      {tickets.isPending && <div className="table-skeleton" role="status" aria-label={text('جاري التحميل', 'Loading')}>{[0, 1, 2, 3].map(index => <Skeleton key={index} height={44} />)}</div>}
      {tickets.data && tickets.data.items.length === 0 && <div className="empty-state" data-testid="tickets-empty">
        <span className="empty-state-icon" aria-hidden="true">{q ? <MagnifyingGlassIcon size={30} /> : <ChatsCircleIcon size={30} />}</span>
        <h2>{q ? text('مفيش تذاكر مطابقة', 'No matching tickets') : text('مفيش تذاكر هنا', 'No tickets here')}</h2>
        <p>{text('التذاكر اللي المطاعم بتفتحها من المساعد بتظهر هنا.', 'Tickets restaurants open from the assistant appear here.')}</p>
      </div>}
      {tickets.data && tickets.data.items.length > 0 && <div className="table-scroll">
        <table className="data-table support-table">
          <thead><tr>
            <th scope="col">{text('التذكرة', 'Ticket')}</th>
            <th scope="col">{text('المطعم والعميل', 'Restaurant and requester')}</th>
            <th scope="col">{text('الموضوع', 'Category')}</th>
            <th scope="col">{text('الأهمية', 'Priority')}</th>
            <th scope="col">{text('الحالة', 'Status')}</th>
            <th scope="col">{text('المسؤول', 'Assignee')}</th>
            <th scope="col">{text('آخر نشاط', 'Last activity')}</th>
          </tr></thead>
          <tbody>
            {tickets.data.items.map(ticket => <tr key={ticket.id} data-testid="ticket-row" data-unread={ticket.unread || undefined} className={ticket.unread ? 'is-unread' : undefined}>
              <td className="cell-primary">
                <Link className="table-link row-link" to={`/admin/support/${ticket.id}`}>
                  {ticket.unread && <span className="support-unread-dot" aria-label={text('فيه جديد', 'Unread')} />}<span className="ltr support-ref">{ticket.reference}</span> <bdi>{ticket.subject}</bdi>
                  {ticket.channel === 'CHAT' && <span className="tk-live">{text('شات', 'Chat')}</span>}
                </Link>
                <small>{formatDate(ticket.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</small>
              </td>
              <td data-label={text('المطعم', 'Restaurant')}><bdi>{ticket.restaurant.name}</bdi><small><bdi>{ticket.requester.fullName}</bdi> · <span className="ltr">{ticket.requester.email}</span></small></td>
              <td data-label={text('الموضوع', 'Category')}>{text(...TOPIC_LABELS[ticket.topic])}</td>
              <td data-label={text('الأهمية', 'Priority')}><PriorityBadge priority={ticket.priority} /></td>
              <td data-label={text('الحالة', 'Status')}><TicketStatusBadge status={ticket.status} /></td>
              <td data-label={text('المسؤول', 'Assignee')}>{ticket.assignee ? <bdi>{ticket.assignee.fullName}</bdi> : <span className="muted">{text('مش متعيّنة', 'Unassigned')}</span>}</td>
              <td data-label={text('آخر نشاط', 'Last activity')} className="cell-nowrap">{formatRelative(ticket.lastActivityAt, language)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    </section>
    {tickets.data && tickets.data.total > 0 && <TicketPager page={page} pageSize={pageSize} total={tickets.data.total}
      onPage={next => { update({ page: next === 1 ? null : next }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      onSize={size => update({ size: size === AGENT_PAGE_SIZES[0] ? null : size, page: null })} />}
  </div>;
}

/** "Showing 11–20 of 46", page numbers with previous / next, and how many tickets a page shows. */
function TicketPager({ page, pageSize, total, onPage, onSize }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; onSize: (size: number) => void }) {
  const { text, number, language } = useLanguage();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);
  const Previous = language === 'ar' ? CaretRightIcon : CaretLeftIcon;
  const Next = language === 'ar' ? CaretLeftIcon : CaretRightIcon;
  return <nav className="tk-pager" aria-label={text('صفحات التذاكر', 'Ticket pages')} data-testid="ticket-pager">
    <p className="tk-pager-range" aria-live="polite">{text(`عرض ${number(from)}–${number(to)} من ${number(total)} تذكرة`, `Showing ${from}–${to} of ${total} tickets`)}</p>
    <div className="tk-pager-pages">
      <button type="button" className="tk-pager-step" disabled={current <= 1} onClick={() => onPage(current - 1)} aria-label={text('الصفحة السابقة', 'Previous page')}><Previous size={16} aria-hidden="true" /></button>
      {pageWindow(current, pages).map((value, index) => value === null
        ? <span key={`gap-${index}`} className="tk-pager-gap" aria-hidden="true">…</span>
        : <button key={value} type="button" className="tk-pager-page" aria-current={value === current ? 'page' : undefined} onClick={() => onPage(value)}
          aria-label={text(`صفحة ${number(value)}`, `Page ${value}`)}>{number(value)}</button>)}
      <button type="button" className="tk-pager-step" disabled={current >= pages} onClick={() => onPage(current + 1)} aria-label={text('الصفحة التالية', 'Next page')}><Next size={16} aria-hidden="true" /></button>
    </div>
    <label className="tk-pager-size"><span>{text('في الصفحة', 'Per page')}</span>
      <select className="select" value={pageSize} onChange={event => onSize(Number(event.target.value))}>
        {AGENT_PAGE_SIZES.map(size => <option key={size} value={size}>{number(size)}</option>)}
      </select></label>
  </nav>;
}

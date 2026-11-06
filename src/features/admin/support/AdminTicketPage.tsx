import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useId, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowCounterClockwiseIcon, ArrowRightIcon, CheckCircleIcon, EnvelopeSimpleIcon, ImageIcon, InfoIcon, LockSimpleIcon, PaperclipIcon, PaperPlaneRightIcon, PhoneIcon, StorefrontIcon,
  UserCircleCheckIcon, XIcon,
} from '@phosphor-icons/react';
import { type AgentTicket, SUPPORT_LIMITS, TICKET_PRIORITIES, type TicketAttachment, type TicketPriority, type TicketStatus } from '@bilhanah/contracts';
import { Button } from '../../../components/Button';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { useProtectedImage } from '../../../components/ProtectedImage';
import { PageSkeleton } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import { supportApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { formatDate, formatRelative } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useSession } from '../../../lib/session';
import { PriorityBadge, supportKeys, TicketStatusBadge } from './AdminSupportPage';
import { useSupportSocket } from './support-socket';
import { activityLine, PRIORITY_LABELS, STATUS_ACTIONS, STATUS_LABELS, TOPIC_LABELS } from './labels';

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || '?';
const ACTIVITY_PREVIEW = 5;

function Thumb({ attachment }: { attachment: TicketAttachment }) {
  const { text } = useLanguage();
  const image = useProtectedImage(attachment.url);
  return <li className="tk-thumb">
    {image.url ? <a href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt={text(`صورة مرفقة: ${attachment.fileName}`, `Attachment: ${attachment.fileName}`)} /></a>
      : <span><ImageIcon size={18} aria-hidden="true" /></span>}
  </li>;
}

/** One ticket for the support team: what is going on, the conversation, and everything to act on it. */
export function AdminTicketPage() {
  const { ticketId = '' } = useParams();
  const { text, language } = useLanguage();
  const session = useSession();
  const me = { id: session.status === 'authenticated' ? session.user.id : '' };
  const toast = useToast();
  const queryClient = useQueryClient();
  const [allActivity, setAllActivity] = useState(false);
  // The customer typing in this ticket's chat right now (over Socket.IO).
  const [customerTyping, setCustomerTyping] = useState(0);
  const socket = useSupportSocket({
    onTyping: event => { if (event.ticketId === ticketId && event.side === 'CUSTOMER') setCustomerTyping(Date.now() + 4_000); },
    onUpdated: event => { if (event.ticketId === ticketId) setCustomerTyping(0); },
  });
  useEffect(() => {
    if (!customerTyping) return;
    const timer = window.setTimeout(() => setCustomerTyping(0), Math.max(0, customerTyping - Date.now()));
    return () => window.clearTimeout(timer);
  }, [customerTyping]);
  const ticket = useQuery({
    queryKey: supportKeys.ticket(ticketId),
    queryFn: () => supportApi.ticket(ticketId),
    // A live chat has the customer waiting on the other side: keep it close to real time.
    // Socket.IO refreshes it the moment something changes; polling is only a fallback.
    refetchInterval: 30_000,
    staleTime: 0,
  });
  const agents = useQuery({ queryKey: supportKeys.agents, queryFn: supportApi.agents, staleTime: 5 * 60_000 });
  usePageTitle(ticket.data ? `${ticket.data.reference} · الدعم` : 'الدعم الفني', ticket.data ? `${ticket.data.reference} · Support` : 'Support');
  const done = (data: AgentTicket) => {
    queryClient.setQueryData(supportKeys.ticket(ticketId), data);
    void queryClient.invalidateQueries({ queryKey: supportKeys.all, predicate: query => query.queryKey[2] !== 'ticket' });
  };
  const update = useMutation({
    mutationFn: (body: { status?: TicketStatus; priority?: TicketPriority; assigneeId?: string | null }) => supportApi.update(ticketId, body),
    onSuccess: data => { done(data); toast.success(text('اتحفظ', 'Saved')); },
    onError: error => toast.error(errorMessage(error, text)),
  });

  if (ticket.isPending) return <PageSkeleton blocks={3} />;
  if (ticket.isError) return <div className="page"><BackLink /><ErrorPanel error={ticket.error} onRetry={() => void ticket.refetch()} /></div>;
  const data = ticket.data;
  const name = (id: string | null) => agents.data?.find(agent => agent.id === id)?.fullName ?? text('حد من الفريق', 'a team member');
  const reopening = data.status === 'RESOLVED' || data.status === 'CLOSED';
  // One clear next step in the header; the other moves are in the status menu.
  const primary: TicketStatus | null = reopening ? (data.allowedStatuses.includes('IN_PROGRESS') ? 'IN_PROGRESS' : null) : data.allowedStatuses.includes('RESOLVED') ? 'RESOLVED' : null;
  const otherMoves = data.allowedStatuses.filter(status => status !== primary);
  const activity = allActivity ? data.activity : data.activity.slice(-ACTIVITY_PREVIEW);
  const liveChat = data.channel === 'CHAT' && !reopening;
  const waitingChat = liveChat && !data.assignee && !data.firstResponseAt;

  return <div className="page tk-page" data-testid="ticket-detail">
    <BackLink />
    <header className="tk-head">
      <div className="tk-head-main">
        <div className="tk-head-tags">
          <span className="ltr tk-ref">{data.reference}</span>
          <TicketStatusBadge status={data.status} />
          <PriorityBadge priority={data.priority} />
          {data.channel === 'CHAT' && <span className={`tk-live ${liveChat ? 'is-on' : ''}`} data-testid="ticket-live">{liveChat ? text('شات مباشر · العميل مستني', 'Live chat · customer waiting') : text('شات مباشر', 'Live chat')}</span>}
        </div>
        <h1 tabIndex={-1} data-page-title><bdi>{data.subject}</bdi></h1>
        <p className="tk-head-meta">
          <StorefrontIcon size={15} aria-hidden="true" /><bdi>{data.restaurant.name}</bdi>
          <span aria-hidden="true">·</span><bdi>{data.requester.fullName}</bdi>
          <span aria-hidden="true">·</span>{text(...TOPIC_LABELS[data.topic])}
          {data.module && <><span aria-hidden="true">·</span><span className="ltr">/{data.module}</span></>}
          <span aria-hidden="true">·</span><time dateTime={data.createdAt} title={formatDate(data.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}>{formatRelative(data.createdAt, language)}</time>
        </p>
      </div>
      <div className="tk-head-actions">
        {data.assignee?.id !== me.id && <Button disabled={update.isPending} onClick={() => update.mutate({ assigneeId: me.id })}
          icon={<UserCircleCheckIcon size={18} aria-hidden="true" />} data-testid="assign-me" variant={waitingChat ? 'primary' : 'secondary'}>
          {waitingChat ? text('استلم الشات', 'Take the chat') : text('عيّنها ليا', 'Assign to me')}</Button>}
        {primary && <Button disabled={update.isPending} onClick={() => update.mutate({ status: primary })} data-testid={`status-${primary}`}
          icon={reopening ? <ArrowCounterClockwiseIcon size={18} aria-hidden="true" /> : <CheckCircleIcon size={18} aria-hidden="true" />}>
          {reopening ? text('افتحها تاني', 'Reopen') : text('اتحلّت', 'Resolve')}
        </Button>}
      </div>
    </header>

    <div className="tk-layout">
      <section className="tk-conversation" aria-labelledby="conversation-title">
        <h2 id="conversation-title" className="visually-hidden">{text('المحادثة', 'Conversation')}</h2>
        {data.faqQuestion && <p className="tk-origin"><InfoIcon size={16} aria-hidden="true" />{text('جت من سؤال في المساعد مساعدش:', 'Opened from an assistant answer that did not help:')} <strong><bdi>{data.faqQuestion}</bdi></strong></p>}
        <ol className="tk-thread">
          <Entry kind="customer" author={data.requester.fullName} role={text('العميل', 'Customer')} at={data.createdAt} body={data.description} attachments={data.attachments} />
          {data.messages.map(message => <Entry key={message.id} kind={message.internal ? 'note' : message.side === 'AGENT' ? 'agent' : 'customer'}
            author={message.authorName} at={message.createdAt} body={message.body} attachments={message.attachments} message
            role={message.internal ? text('ملاحظة داخلية', 'Internal note') : message.side === 'AGENT' ? text('فريق بالهنا', 'Bilhanah team') : text('العميل', 'Customer')} />)}
        </ol>
        {customerTyping > 0 && <p className="tk-typing" data-testid="customer-typing">
          <span className="tk-typing-dots" aria-hidden="true"><span /><span /><span /></span>
          {text(`${data.requester.fullName} بيكتب…`, `${data.requester.fullName} is typing…`)}
        </p>}
        <Composer ticket={data} onDone={done} onTyping={() => socket.typing(data.id)} />
      </section>

      <aside className="tk-side" aria-label={text('تفاصيل التذكرة', 'Ticket details')}>
        <section className="tk-card" aria-labelledby="details-title">
          <h2 id="details-title">{text('التفاصيل', 'Details')}</h2>
          <div className="tk-props">
            <label className="tk-prop"><span>{text('الحالة', 'Status')}</span>
              <select className="select" value="" disabled={update.isPending || otherMoves.length === 0} onChange={event => event.target.value && update.mutate({ status: event.target.value as TicketStatus })} data-testid="ticket-status-select">
                <option value="">{text(...STATUS_LABELS[data.status])}</option>
                {otherMoves.map(status => <option key={status} value={status} data-testid={`status-option-${status}`}>{text('← ', '→ ')}{reopening && status === 'IN_PROGRESS' ? text('افتحها تاني', 'Reopen') : text(...(STATUS_ACTIONS[status] ?? STATUS_LABELS[status]))}</option>)}
              </select></label>
            <label className="tk-prop"><span>{text('المسؤول', 'Assignee')}</span>
              <select className="select" value={data.assignee?.id ?? ''} disabled={update.isPending} data-testid="ticket-assignee" onChange={event => update.mutate({ assigneeId: event.target.value || null })}>
                <option value="">{text('مش متعيّنة', 'Unassigned')}</option>
                {(agents.data ?? []).map(agent => <option key={agent.id} value={agent.id}>{agent.id === me.id ? text(`${agent.fullName} (إنت)`, `${agent.fullName} (you)`) : `${agent.fullName} · ${agent.email}`}</option>)}
              </select></label>
            <label className="tk-prop"><span>{text('الأهمية', 'Priority')}</span>
              <select className="select" value={data.priority} disabled={update.isPending} data-testid="ticket-priority" onChange={event => update.mutate({ priority: event.target.value as TicketPriority })}>
                {TICKET_PRIORITIES.map(value => <option key={value} value={value}>{text(...PRIORITY_LABELS[value])}</option>)}
              </select></label>
          </div>
          <dl className="tk-facts">
            <div><dt>{text('أول رد', 'First response')}</dt><dd>{data.firstResponseAt ? formatRelative(data.firstResponseAt, language) : <span className="muted">{text('لسه', 'Not yet')}</span>}</dd></div>
            <div><dt>{text('آخر نشاط', 'Last activity')}</dt><dd>{formatRelative(data.lastActivityAt, language)}</dd></div>
          </dl>
        </section>

        <section className="tk-card" aria-labelledby="restaurant-title">
          <h2 id="restaurant-title">{text('المطعم', 'Restaurant')}</h2>
          <div className="tk-who">
            <span className="tk-avatar is-restaurant" aria-hidden="true">{initials(data.restaurant.name)}</span>
            <div>
              <Link className="tk-who-name" to={`/admin/restaurants/${data.restaurant.id}`}><bdi>{data.restaurant.name}</bdi></Link>
              <small className="ltr">{data.restaurant.subdomain}</small>
            </div>
            {data.restaurantInfo.plan && <span className="tk-plan">{data.restaurantInfo.plan}</span>}
          </div>
          <dl className="tk-facts">
            <div><dt>{text('صاحب المطعم', 'Owner')}</dt><dd><bdi>{data.restaurantInfo.ownerName}</bdi></dd></div>
            <div><dt>{text('المدينة', 'City')}</dt><dd>{data.restaurantInfo.city}</dd></div>
            <div><dt>{text('اللي فتح التذكرة', 'Requester')}</dt><dd><bdi>{data.requester.fullName}</bdi> <span className="muted">· {data.requesterRole}</span></dd></div>
          </dl>
          <div className="tk-contact">
            <a className="button button-secondary button-small" href={`tel:${data.restaurantInfo.phone}`}><PhoneIcon size={16} aria-hidden="true" /><span className="ltr">{data.restaurantInfo.phone}</span></a>
            <a className="button button-secondary button-small" href={`mailto:${data.requester.email}`} title={data.requester.email}><EnvelopeSimpleIcon size={16} aria-hidden="true" />{text('إيميل', 'Email')}</a>
          </div>
        </section>

        <section className="tk-card" aria-labelledby="history-title">
          <h2 id="history-title">{text('السجل', 'History')}</h2>
          <ol className="tk-timeline" data-testid="ticket-timeline">
            {activity.map(entry => <li key={entry.id}>
              <p><strong><bdi>{entry.actorName ?? text('النظام', 'System')}</bdi></strong> {activityLine(entry.kind, entry.from, entry.to, text, name)}</p>
              <time dateTime={entry.createdAt}>{formatDate(entry.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</time>
            </li>)}
          </ol>
          {data.activity.length > ACTIVITY_PREVIEW && <button type="button" className="link-action tk-more" onClick={() => setAllActivity(value => !value)}>
            {allActivity ? text('اعرض الأحدث بس', 'Show latest only') : text(`اعرض كل السجل (${data.activity.length})`, `Show full history (${data.activity.length})`)}
          </button>}
        </section>
      </aside>
    </div>
  </div>;
}

function Entry({ kind, author, role, at, body, attachments, message = false }: { kind: 'customer' | 'agent' | 'note'; author: string; role: string; at: string; body: string; attachments: TicketAttachment[]; message?: boolean }) {
  const { language } = useLanguage();
  return <li className={`tk-entry is-${kind}`} data-testid={message ? 'ticket-message' : 'ticket-description'} data-internal={kind === 'note' || undefined}>
    <span className={`tk-avatar is-${kind}`} aria-hidden="true">{kind === 'note' ? <LockSimpleIcon size={15} weight="bold" /> : initials(author)}</span>
    <div className="tk-entry-body">
      <p className="tk-entry-head"><strong><bdi>{author}</bdi></strong><span className="tk-role">{role}</span>
        <time dateTime={at} title={formatDate(at, language, { dateStyle: 'medium', timeStyle: 'short' })}>{formatRelative(at, language)}</time></p>
      <p className="tk-entry-text">{body}</p>
      {attachments.length > 0 && <ul className="tk-thumbs">{attachments.map(attachment => <Thumb key={attachment.id} attachment={attachment} />)}</ul>}
    </div>
  </li>;
}

function BackLink() {
  const { text } = useLanguage();
  return <Link to="/admin/support" className="back-link"><ArrowRightIcon size={16} className="directional" aria-hidden="true" />{text('كل التذاكر', 'All tickets')}</Link>;
}

/** A public reply to the restaurant, or an internal note; Ctrl/⌘ + Enter sends. */
function Composer({ ticket, onDone, onTyping }: { ticket: AgentTicket; onDone: (data: AgentTicket) => void; onTyping: () => void }) {
  const { text } = useLanguage();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<{ key: string; name: string; attachment?: TicketAttachment; error?: string }[]>([]);
  const id = useId();
  const reply = useMutation({
    mutationFn: () => supportApi.reply(ticket.id, { body, internal, attachmentIds: files.flatMap(file => (file.attachment ? [file.attachment.id] : [])) }),
    onSuccess: data => { onDone(data); setBody(''); setFiles([]); },
  });
  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    for (const file of Array.from(event.target.files ?? []).slice(0, SUPPORT_LIMITS.attachments - files.length)) {
      const key = `${file.name}-${Math.random()}`;
      setFiles(current => [...current, { key, name: file.name }]);
      supportApi.upload(file).then(
        attachment => setFiles(current => current.map(item => (item.key === key ? { ...item, attachment } : item))),
        (error: unknown) => setFiles(current => current.map(item => (item.key === key ? { ...item, error: errorMessage(error, text) } : item))),
      );
    }
    event.target.value = '';
  };
  const uploading = files.some(file => !file.attachment && !file.error);
  const closed = ticket.status === 'CLOSED' && !internal;
  const canSend = body.trim() !== '' && !uploading && !closed && !reply.isPending;
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (canSend) reply.mutate();
  };
  const shortcut = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
  };
  return <form className={`tk-composer ${internal ? 'is-note' : ''}`} onSubmit={submit}>
    <div className="tk-composer-tabs" role="radiogroup" aria-label={text('نوع الرسالة', 'Message type')}>
      <label><input type="radio" name={`${id}-kind`} checked={!internal} onChange={() => setInternal(false)} /><span>{text('رد على العميل', 'Reply to customer')}</span></label>
      <label><input type="radio" name={`${id}-kind`} checked={internal} onChange={() => setInternal(true)} data-testid="note-toggle" /><LockSimpleIcon size={14} aria-hidden="true" /><span>{text('ملاحظة داخلية', 'Internal note')}</span></label>
    </div>
    {closed && <p className="tk-composer-notice"><InfoIcon size={16} aria-hidden="true" />{text('التذكرة مقفولة. افتحها تاني عشان ترد على العميل، أو اكتب ملاحظة داخلية.', 'This ticket is closed. Reopen it to reply to the customer, or add an internal note.')}</p>}
    <label htmlFor={`${id}-body`} className="visually-hidden">{internal ? text('الملاحظة', 'Note') : text('الرد', 'Reply')}</label>
    <textarea id={`${id}-body`} rows={4} value={body} onChange={event => { setBody(event.target.value); if (!internal && event.target.value) onTyping(); }} onKeyDown={shortcut} maxLength={SUPPORT_LIMITS.reply} disabled={closed}
      placeholder={internal ? text('ملاحظة للفريق بس، العميل مش هيشوفها…', 'A note for the team only; the customer will not see it…') : text('اكتب ردك على المطعم…', 'Write your reply to the restaurant…')} />
    {files.length > 0 && <ul className="tk-files">
      {files.map(file => <li key={file.key} className={file.error ? 'has-error' : ''}><ImageIcon size={14} aria-hidden="true" /><bdi>{file.name}</bdi>{!file.attachment && !file.error && <span className="spinner" aria-hidden="true" />}
        {file.error && <small role="alert">{file.error}</small>}
        <button type="button" onClick={() => setFiles(current => current.filter(item => item.key !== file.key))} aria-label={text(`شيل ${file.name}`, `Remove ${file.name}`)}><XIcon size={13} /></button></li>)}
    </ul>}
    {reply.isError && <p className="field-error" role="alert">{errorMessage(reply.error, text)}</p>}
    <div className="tk-composer-bar">
      {files.length < SUPPORT_LIMITS.attachments && !closed && <label className="tk-attach" title={text('ضيف صورة', 'Attach an image')}>
        <PaperclipIcon size={18} aria-hidden="true" /><span className="visually-hidden">{text('ضيف صورة', 'Attach an image')}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="visually-hidden" onChange={pick} /></label>}
      <span className="tk-hint">{internal ? text('مش هتتبعت للعميل', 'Not sent to the customer') : text('Ctrl + Enter للإرسال', 'Ctrl + Enter to send')}</span>
      <Button type="submit" loading={reply.isPending} disabled={!canSend} data-testid="ticket-send" icon={internal ? <LockSimpleIcon size={16} aria-hidden="true" /> : <PaperPlaneRightIcon size={16} weight="fill" aria-hidden="true" />}>
        {internal ? text('احفظ الملاحظة', 'Save note') : text('ابعت الرد', 'Send reply')}
      </Button>
    </div>
  </form>;
}

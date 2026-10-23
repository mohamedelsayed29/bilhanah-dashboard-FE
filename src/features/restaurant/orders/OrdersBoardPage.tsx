import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { LockIcon, PowerIcon, SpeakerHighIcon, SpeakerSlashIcon } from '@phosphor-icons/react';
import type { OrderStatus, OwnerOrder } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { Switch } from '../../../components/Switch';
import { useLanguage, usePageTitle } from '../../../lib/language';
import type { ConnectionState } from '../../../lib/realtime/owner-realtime';
import { useRestaurant } from '../queries';
import { COLUMNS, groupByColumn, needsReason, type Column } from './board';
import { useBoardQuery, useOrdersLive } from './live';
import { useOrdersPause, useOrderStatus } from './mutations';
import { OrderCard, useNow } from './OrderCard';
import { ReasonDialog } from './ReasonDialog';

const COLUMN_TEXT: Record<Column, { ar: string; en: string; emptyAr: string; emptyEn: string }> = {
  new: { ar: 'جديد', en: 'New', emptyAr: 'مفيش طلبات جديدة. أول ما زبون يطلب هيظهر هنا وهتسمع تنبيه.', emptyEn: 'No new orders. When a diner orders, it appears here with a sound.' },
  progress: { ar: 'بيتحضّر', en: 'In progress', emptyAr: 'الطلبات اللي قبلتها هتفضل هنا لحد ما تجهز.', emptyEn: 'Orders you accept stay here until they are ready.' },
  ready: { ar: 'جاهز', en: 'Ready', emptyAr: 'الطلبات الجاهزة للتسليم هتظهر هنا.', emptyEn: 'Orders ready to hand over appear here.' },
};

/** Live board / history switch shared by both order pages. */
export function OrdersTabs() {
  const { text } = useLanguage();
  return <nav className="tabs" aria-label={text('أقسام الطلبات', 'Order sections')}>
    <NavLink to="/orders" end className="tab">{text('اللوحة المباشرة', 'Live board')}</NavLink>
    <NavLink to="/orders/history" className="tab">{text('الطلبات السابقة', 'History')}</NavLink>
  </nav>;
}

export function ConnectionPill({ state }: { state: ConnectionState }) {
  const { text } = useLanguage();
  const live = state === 'connected';
  return <span className={`connection-pill ${live ? 'is-live' : 'is-waiting'}`} role="status" data-testid="connection-state">
    <span className="connection-dot" aria-hidden="true" />
    {live ? text('مباشر', 'Live') : state === 'connecting' ? text('بنوصّل…', 'Connecting…') : text('بنعيد الاتصال…', 'Reconnecting…')}
  </span>;
}

export function OrdersBoardPage() {
  const { text, number, count } = useLanguage();
  usePageTitle('الطلبات', 'Orders');
  const restaurant = useRestaurant();
  const { ordering } = restaurant;
  const live = useOrdersLive();
  const board = useBoardQuery(ordering.included);
  const [announcement, setAnnouncement] = useState('');
  const status = useOrderStatus({ announce: setAnnouncement });
  const pause = useOrdersPause();
  const now = useNow();
  const [closing, setClosing] = useState<{ order: OwnerOrder; status: 'REJECTED' | 'CANCELLED' } | null>(null);
  const [column, setColumn] = useState<Column>('new');
  const { markSeen, unseen } = live;

  // Touching the board (click or key) counts as having seen the new orders.
  useEffect(() => {
    if (unseen.size === 0) return;
    const seen = () => { if (document.visibilityState === 'visible') markSeen(); };
    document.addEventListener('pointerdown', seen);
    document.addEventListener('keydown', seen);
    return () => {
      document.removeEventListener('pointerdown', seen);
      document.removeEventListener('keydown', seen);
    };
  }, [unseen.size, markSeen]);

  const act = (order: OwnerOrder, next: OrderStatus) => {
    if (needsReason(next)) setClosing({ order, status: next as 'REJECTED' | 'CANCELLED' });
    else if (next !== 'PLACED') status.mutate({ order, status: next });
  };

  const header = <PageHeader title={text('الطلبات', 'Orders')}
    actions={ordering.included && ordering.enabled ? <ConnectionPill state={live.connection} /> : undefined} />;

  if (!ordering.included) {
    return <div className="page orders-page">
      {header}
      <section className="card empty-state upsell-card" aria-labelledby="upsell-title">
        <span className="empty-state-icon" aria-hidden="true"><LockIcon size={30} /></span>
        <h2 id="upsell-title">{text('استقبل الطلبات من الموبايل', 'Take orders from diners’ phones')}</h2>
        <p>{text('باقتك الحالية فيها المنيو بس. اشترك في باقة «منيو وطلبات» عشان الزباين يطلبوا من الترابيزة أو تيك أواي، والطلبات توصلك هنا لحظة بلحظة.',
          'Your current plan includes the menu only. Choose the “Menu & Orders” plan so diners can order from their table or for pickup, with orders arriving here live.')}</p>
        <Link className="button button-primary" to="/subscription">{text('شوف الباقات', 'See plans')}</Link>
      </section>
    </div>;
  }

  const orders = board.data ?? [];
  const columns = groupByColumn(orders);
  const soundPrompt = ordering.enabled && live.sound.on && live.sound.audio === 'locked';

  return <div className="page orders-page">
    {header}
    <OrdersTabs />
    {!ordering.enabled && <section className="card empty-state upsell-card" aria-labelledby="enable-title">
      <span className="empty-state-icon" aria-hidden="true"><PowerIcon size={30} /></span>
      <h2 id="enable-title">{text('شغّل الطلبات', 'Turn on ordering')}</h2>
      <p>{text('باقتك فيها الطلبات، بس لسه مش متشغّلة. شغّلها واختار صالة ولا تيك أواي، والزباين هيلاقوا زرار الطلب في المنيو.',
        'Your plan includes ordering, but it is switched off. Turn it on and choose dine-in and/or pickup; diners then see an order button on your menu.')}</p>
      <Link className="button button-primary" to="/settings/ordering">{text('إعدادات الطلبات', 'Ordering settings')}</Link>
    </section>}

    {ordering.enabled && <div className="board-toolbar">
      <Switch className="board-pause" checked={!ordering.paused} disabled={pause.isPending} onChange={accepting => pause.mutate(!accepting)}
        label={ordering.paused ? text('الطلبات واقفة مؤقتًا', 'Orders paused') : text('بنستقبل طلبات', 'Taking orders')}
        description={ordering.paused ? text('الزباين شايفين إنك مش بتستقبل طلبات دلوقتي.', 'Diners see that you are not taking orders right now.') : text('وقّفها مؤقتًا لو المطبخ زحمة.', 'Pause for a while if the kitchen is busy.')} />
      <div className="board-sound">
        {soundPrompt && <p className="sound-locked" role="status">
          <span>{text('الصوت مقفول لحد ما تلمس الصفحة', 'Sound is off until you tap the page')}</span>
          <Button small onClick={() => void live.sound.unlock()} icon={<SpeakerHighIcon size={17} aria-hidden="true" />}>{text('شغّل الصوت', 'Enable sound')}</Button>
        </p>}
        <button type="button" className={`sound-toggle ${live.sound.on ? 'is-on' : ''}`} aria-pressed={live.sound.on} onClick={() => live.sound.setOn(!live.sound.on)}
          title={text('صوت الطلبات الجديدة', 'New-order sound')}>
          {live.sound.on ? <SpeakerHighIcon size={20} weight="bold" aria-hidden="true" /> : <SpeakerSlashIcon size={20} weight="bold" aria-hidden="true" />}
          <span className="sound-label">{text('صوت الطلبات الجديدة', 'New-order sound')}</span>
        </button>
      </div>
    </div>}

    {ordering.enabled && ordering.paused && <Alert kind="warning" title={text('استقبال الطلبات واقف مؤقتًا', 'New orders are paused')}
      actions={<Button small variant="secondary" loading={pause.isPending} onClick={() => pause.mutate(false)}>{text('ارجع استقبل طلبات', 'Resume orders')}</Button>}>
      {text('الطلبات اللي على اللوحة كمّل فيها عادي، بس مفيش طلبات جديدة هتوصل.', 'Keep working on the orders below; no new ones can be placed.')}
    </Alert>}

    {board.isError && <ErrorPanel error={board.error} onRetry={() => void board.refetch()} />}
    {board.isPending && <div className="board" role="status" aria-label={text('جاري التحميل', 'Loading')}>
      {COLUMNS.map(key => <div className="board-column" key={key}><Skeleton height={28} width="50%" /><Skeleton height={180} radius={12} /></div>)}
    </div>}

    {board.data && (ordering.enabled || orders.length > 0) && <>
      <div className="board-switch segmented" role="group" aria-label={text('اختار العمود', 'Choose a column')}>
        {COLUMNS.map(key => <button type="button" key={key} aria-pressed={column === key} onClick={() => setColumn(key)}>
          {text(COLUMN_TEXT[key].ar, COLUMN_TEXT[key].en)}
          <span className={`board-count ${key === 'new' && columns.new.length > 0 ? 'is-hot' : ''}`}>{number(columns[key].length)}</span>
        </button>)}
      </div>
      <div className="board">
        {COLUMNS.map(key => {
          return <section key={key} className={`board-column board-column-${key} ${column === key ? 'is-current' : ''}`} aria-labelledby={`column-${key}`} data-testid={`column-${key}`}>
            <header className="board-column-head">
              <h2 id={`column-${key}`}>{text(COLUMN_TEXT[key].ar, COLUMN_TEXT[key].en)}</h2>
              <span className="board-count" aria-label={count(columns[key].length, 'order')}>{number(columns[key].length)}</span>
            </header>
            {columns[key].length === 0
              ? <p className="board-empty">{text(COLUMN_TEXT[key].emptyAr, COLUMN_TEXT[key].emptyEn)}</p>
              : <div className="board-cards">
                {columns[key].map(order => <OrderCard key={order.id} order={order} now={now} isNew={live.unseen.has(order.id)} onAction={act} />)}
              </div>}
          </section>;
        })}
      </div>
    </>}

    <p className="visually-hidden" aria-live="polite" data-testid="board-announcement">{announcement}</p>
    <ReasonDialog order={closing?.order ?? null} status={closing?.status ?? 'REJECTED'} onClose={() => setClosing(null)}
      onConfirm={reason => { if (closing) status.mutate({ order: closing.order, status: closing.status, reason }); setClosing(null); }} />
  </div>;
}

import { useEffect, useState } from 'react';
import { LockIcon, PowerIcon, ProhibitIcon, SpeakerHighIcon, SpeakerSlashIcon } from '@phosphor-icons/react';
import type { OrderStatus, OwnerOrder } from '@bilhanah/contracts';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ErrorPanel } from '../../components/ErrorBoundary';
import { Skeleton } from '../../components/Skeleton';
import { useCopy } from '../../lib/copy';
import { useLanguage, usePageTitle } from '../../lib/language';
import { useBranchScope } from '../branches/BranchScope';
import { SoldOutDialog } from '../branches/SoldOutDialog';
import { useBranchesQuery } from '../restaurant/queries';
import { COLUMNS, groupByColumn, needsReason, type Column } from '../restaurant/orders/board';
import { useBoardQuery, useOrdersLive } from '../restaurant/orders/live';
import { useOrderStatus } from '../restaurant/orders/mutations';
import { OrderCard, useNow } from '../restaurant/orders/OrderCard';
import { ConnectionPill } from '../restaurant/orders/OrdersBoardPage';
import { ReasonDialog } from '../restaurant/orders/ReasonDialog';
import { useKitchenContext } from './KitchenLayout';

const COLUMN_TEXT: Record<Column, { ar: string; en: string; emptyAr: string; emptyEn: string }> = {
  new: { ar: 'جديد', en: 'New', emptyAr: 'مفيش طلبات جديدة. أول ما زبون يطلب هيظهر هنا وهتسمع تنبيه.', emptyEn: 'No new orders. When a diner orders, it appears here with a sound.' },
  progress: { ar: 'بيتحضّر', en: 'Cooking', emptyAr: 'الطلبات اللي قبلتها هتفضل هنا لحد ما تجهز.', emptyEn: 'Accepted orders stay here until they are ready.' },
  ready: { ar: 'جاهز', en: 'Ready', emptyAr: 'الطلبات الجاهزة للتسليم هتظهر هنا.', emptyEn: 'Orders ready to hand over appear here.' },
};

/** The kitchen display: every active order, large and live, with the steps the kitchen takes. No prices or settings. */
export function KitchenBoardPage() {
  const { text, number, count } = useLanguage();
  const t = useCopy();
  usePageTitle('المطبخ', 'Kitchen');
  const context = useKitchenContext();
  const scope = useBranchScope();
  // The chosen branch's own switches when known (all-branch screens); the context's otherwise.
  const branches = useBranchesQuery();
  const ordering = (scope.branch && branches.data?.branches.find(branch => branch.id === scope.branch!.id)?.ordering) || context.ordering;
  const live = useOrdersLive();
  const board = useBoardQuery(scope.selected, ordering.included);
  const [soldOutOpen, setSoldOutOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const status = useOrderStatus({ announce: setAnnouncement });
  const now = useNow();
  const [closing, setClosing] = useState<{ order: OwnerOrder; status: 'REJECTED' | 'CANCELLED' } | null>(null);
  const [column, setColumn] = useState<Column>('new');
  const { markSeen, unseen } = live;

  // Touching the screen (tap or key) counts as having seen the new orders.
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

  if (!ordering.included || !ordering.enabled) {
    const plan = !ordering.included;
    return <div className="page kitchen-page">
      <section className="card empty-state upsell-card" aria-labelledby="kitchen-off-title">
        <span className="empty-state-icon" aria-hidden="true">{plan ? <LockIcon size={30} /> : <PowerIcon size={30} />}</span>
        <h1 id="kitchen-off-title">{text('الطلبات مش شغّالة', 'Ordering is off')}</h1>
        <p>{plan
          ? text('باقة المطعم مفيهاش استقبال طلبات. صاحب المطعم يقدر يغيّر الباقة من لوحة التحكم.', 'The restaurant’s plan does not include ordering. The owner can change it from the dashboard.')
          : text('صاحب المطعم لسه مشغّلش الطلبات. أول ما يشغّلها، الطلبات هتظهر هنا لوحدها.', 'The owner has not turned ordering on yet. Once they do, orders appear here by themselves.')}</p>
      </section>
    </div>;
  }

  const orders = board.data ?? [];
  const columns = groupByColumn(orders);
  const soundPrompt = live.sound.on && live.sound.audio === 'locked';

  return <div className="page kitchen-page">
    <h1 className="visually-hidden">{text('شاشة المطبخ', 'Kitchen screen')}</h1>
    <div className="board-toolbar kitchen-toolbar">
      <ConnectionPill state={live.connection} />
      <Button variant="secondary" small onClick={() => setSoldOutOpen(true)} icon={<ProhibitIcon size={17} weight="bold" aria-hidden="true" />} data-testid="kitchen-sold-out">
        {t.branchMenu.soldOutTitle}
      </Button>
      <div className="board-sound">
        {soundPrompt && <p className="sound-locked" role="status">
          <span>{text('الصوت مقفول لحد ما تلمس الشاشة', 'Sound is off until you tap the screen')}</span>
          <Button small onClick={() => void live.sound.unlock()} icon={<SpeakerHighIcon size={17} aria-hidden="true" />}>{text('شغّل الصوت', 'Enable sound')}</Button>
        </p>}
        <button type="button" className={`sound-toggle ${live.sound.on ? 'is-on' : ''}`} aria-pressed={live.sound.on} onClick={() => live.sound.setOn(!live.sound.on)}
          title={text('صوت الطلبات الجديدة', 'New-order sound')}>
          {live.sound.on ? <SpeakerHighIcon size={20} weight="bold" aria-hidden="true" /> : <SpeakerSlashIcon size={20} weight="bold" aria-hidden="true" />}
          <span className="sound-label">{text('صوت الطلبات الجديدة', 'New-order sound')}</span>
        </button>
      </div>
    </div>

    {ordering.paused && <Alert kind="warning" title={text('استقبال الطلبات واقف مؤقتًا', 'New orders are paused')}>
      {text('كمّلوا في الطلبات اللي على الشاشة، مفيش طلبات جديدة هتوصل لحد ما صاحب المطعم يرجّعها.', 'Keep working on the orders below; no new ones arrive until the owner resumes them.')}
    </Alert>}

    {board.isError && <ErrorPanel error={board.error} onRetry={() => void board.refetch()} />}
    {board.isPending && <div className="board" role="status" aria-label={text('جاري التحميل', 'Loading')}>
      {COLUMNS.map(key => <div className="board-column" key={key}><Skeleton height={28} width="50%" /><Skeleton height={220} radius={12} /></div>)}
    </div>}

    {board.data && <>
      <div className="board-switch segmented" role="group" aria-label={text('اختار العمود', 'Choose a column')}>
        {COLUMNS.map(key => <button type="button" key={key} aria-pressed={column === key} onClick={() => setColumn(key)}>
          {text(COLUMN_TEXT[key].ar, COLUMN_TEXT[key].en)}
          <span className={`board-count ${key === 'new' && columns.new.length > 0 ? 'is-hot' : ''}`}>{number(columns[key].length)}</span>
        </button>)}
      </div>
      <div className="board kitchen-board">
        {COLUMNS.map(key => <section key={key} className={`board-column board-column-${key} ${column === key ? 'is-current' : ''}`} aria-labelledby={`column-${key}`} data-testid={`column-${key}`}>
          <header className="board-column-head">
            <h2 id={`column-${key}`}>{text(COLUMN_TEXT[key].ar, COLUMN_TEXT[key].en)}</h2>
            <span className="board-count" aria-label={count(columns[key].length, 'order')}>{number(columns[key].length)}</span>
          </header>
          {columns[key].length === 0
            ? <p className="board-empty">{text(COLUMN_TEXT[key].emptyAr, COLUMN_TEXT[key].emptyEn)}</p>
            : <div className="board-cards">
              {columns[key].map(order => <OrderCard key={order.id} kitchen order={order} now={now} isNew={live.unseen.has(order.id)} showBranch={scope.selected === 'all' && scope.choices.length > 1} onAction={act} />)}
            </div>}
        </section>)}
      </div>
    </>}

    <p className="visually-hidden" aria-live="polite" data-testid="board-announcement">{announcement}</p>
    <SoldOutDialog branch={scope.branch} open={soldOutOpen} onClose={() => setSoldOutOpen(false)} />
    <ReasonDialog order={closing?.order ?? null} status={closing?.status ?? 'REJECTED'} onClose={() => setClosing(null)}
      onConfirm={reason => { if (closing) status.mutate({ order: closing.order, status: closing.status, reason }); setClosing(null); }} />
  </div>;
}

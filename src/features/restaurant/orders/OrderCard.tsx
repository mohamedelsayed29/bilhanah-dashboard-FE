import { useEffect, useState } from 'react';
import { BellRingingIcon, PhoneIcon } from '@phosphor-icons/react';
import type { OrderStatus, OwnerOrder } from '@bilhanah/contracts';
import { Button } from '../../../components/Button';
import { formatDate, formatPrice } from '../../../lib/format';
import { useLanguage } from '../../../lib/language';
import { minutesSince, needsReason, orderActions } from './board';
import { actionName, elapsedLabel, lineName, OrderNo, orderTypeName, statusName } from './labels';

/** Re-renders every `ms` so "time since placed" stays current. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

/** New orders waiting longer than this are flagged. */
const LATE_MINUTES = { PLACED: 5, ACCEPTED: 20, PREPARING: 25, READY: 15 } as Partial<Record<OrderStatus, number>>;

/** Dine-in table or pickup customer on one line, with a tap-to-call phone for pickup. */
export function OrderWhere({ order }: { order: OwnerOrder }) {
  const { text } = useLanguage();
  return <p className={`order-where order-where-${order.type === 'DINE_IN' ? 'dine' : 'pickup'}`}>
    <strong className="order-place">{order.type === 'DINE_IN'
      ? <>{orderTypeName(order.type, text)} · <bdi className="order-table">{order.tableLabel ?? text('طاولة غير محددة', 'Table not set')}</bdi></>
      : orderTypeName(order.type, text)}</strong>
    <bdi className="order-customer">{order.customerName}</bdi>
    {order.customerPhone && <a className="order-phone" href={`tel:${order.customerPhone}`} aria-label={text(`اتصل بـ ${order.customerName}: ${order.customerPhone}`, `Call ${order.customerName}: ${order.customerPhone}`)}>
      <PhoneIcon size={15} weight="bold" aria-hidden="true" /><span className="ltr">{order.customerPhone}</span>
    </a>}
  </p>;
}

/** What to make: quantity, dish and size, and each line's note; then the order's own note. */
export function OrderLines({ order, prices = false }: { order: OwnerOrder; prices?: boolean }) {
  const { language, number, text } = useLanguage();
  return <>
    <ul className="order-lines">
      {order.items.map(line => {
        const { name, size } = lineName(line, language);
        return <li key={line.id}>
          <span className="order-qty">{number(line.quantity)}×</span>
          <div>
            <span className="order-line-name">{name}{size && <span className="order-line-size"> — {size}</span>}</span>
            {line.note && <p className="order-line-note"><span className="visually-hidden">{text('ملاحظة:', 'Note:')} </span>{line.note}</p>}
          </div>
          {prices && <span className="order-line-price">{formatPrice(line.lineTotalPiastres, language)}</span>}
        </li>;
      })}
    </ul>
    {order.note && <p className="order-note"><span className="order-note-label">{text('ملاحظة الطلب', 'Order note')}</span>{order.note}</p>}
  </>;
}

/** The diner turned on notifications for this order (the Full Experience plan), so nobody needs to call out their name. */
function OrderNotifies({ ready }: { ready: boolean }) {
  const { text } = useLanguage();
  const label = ready
    ? text('اتبعت للزبون إشعار إن طلبه جاهز', 'The guest was notified that it is ready')
    : text('الزبون هيوصله إشعار أول ما الطلب يجهز', 'The guest gets a notification when it is ready');
  return <span className="order-notifies" title={label}>
    <BellRingingIcon size={16} weight="bold" aria-hidden="true" /><span className="visually-hidden">{label}</span>
  </span>;
}

type Props = {
  order: OwnerOrder;
  now: number;
  isNew: boolean;
  onAction: (order: OwnerOrder, status: OrderStatus) => void;
};

/**
 * One order on the board, read at a glance from across a kitchen: the number and how long it has
 * waited, where it goes, what to make, the note, and one primary action.
 */
export function OrderCard({ order, now, isNew, onAction }: Props) {
  const { text, number, language } = useLanguage();
  const minutes = minutesSince(order.placedAt, now);
  const late = minutes >= (LATE_MINUTES[order.status] ?? Infinity);
  const { primary, secondary } = orderActions(order.status);
  const headingId = `order-${order.id}-title`;
  // The column already says "new" and "ready"; in progress, accepted and preparing share a column.
  const showStatus = order.status === 'ACCEPTED' || order.status === 'PREPARING';
  return <article className={`order-card order-card-${order.status.toLowerCase()} ${isNew ? 'is-new' : ''} ${late ? 'is-late' : ''}`} aria-labelledby={headingId} data-testid={`order-${order.number}`}>
    <header className="order-card-head">
      <h3 id={headingId} className="order-number"><span className="visually-hidden">{text('طلب', 'Order')} </span><OrderNo number={order.number} /></h3>
      {isNew && order.status === 'PLACED' && <span className="order-flag">{text('جديد', 'New')}</span>}
      {showStatus && <span className="order-status">{statusName(order.status, text)}</span>}
      <span className="order-meta">
        {order.notifiesDiner && <OrderNotifies ready={order.status === 'READY'} />}
        <time className={`order-age ${late ? 'is-late' : ''}`} dateTime={order.placedAt} title={formatDate(order.placedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}>
          {elapsedLabel(minutes, text, number)}
        </time>
      </span>
    </header>
    <OrderWhere order={order} />
    <OrderLines order={order} />
    <p className="order-total"><span>{text('الإجمالي', 'Subtotal')}</span><strong>{formatPrice(order.subtotalPiastres, language)}</strong></p>
    {(primary || secondary.length > 0) && <footer className="order-actions">
      {primary && <Button className="order-primary" onClick={() => onAction(order, primary)}>{actionName(primary, text)}</Button>}
      {secondary.map(status => <Button key={status} variant={needsReason(status) ? 'danger-outline' : 'secondary'} className="order-secondary" onClick={() => onAction(order, status)}>
        {actionName(status, text)}
      </Button>)}
    </footer>}
  </article>;
}

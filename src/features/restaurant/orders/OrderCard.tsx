import { useEffect, useState } from 'react';
import { BellRingingIcon, CheckCircleIcon, ClockIcon, ForkKnifeIcon, PhoneIcon, ShoppingBagIcon, StorefrontIcon } from '@phosphor-icons/react';
import type { OrderStatus, OwnerOrder } from '@bilhanah/contracts';
import { Button } from '../../../components/Button';
import { useCopy } from '../../../lib/copy';
import { formatDate, formatPrice } from '../../../lib/format';
import { useLanguage } from '../../../lib/language';
import { minutesSince, needsReason, orderActions } from './board';
import { actionName, elapsedLabel, lineName, OrderNo, OrderStatusBadge, orderTypeName } from './labels';

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

/** Dine-in table or pickup customer on one line, with a tap-to-call phone for pickup (unless `phone` is false). */
export function OrderWhere({ order, phone = true }: { order: OwnerOrder; phone?: boolean }) {
  const { text } = useLanguage();
  const dineIn = order.type === 'DINE_IN';
  return <p className={`order-where order-where-${dineIn ? 'dine' : 'pickup'}`}>
    <strong className="order-place">
      {dineIn ? <ForkKnifeIcon size={14} weight="bold" aria-hidden="true" /> : <ShoppingBagIcon size={14} weight="bold" aria-hidden="true" />}
      {dineIn
        ? <>{orderTypeName(order.type, text)} · <bdi className="order-table">{order.tableLabel ?? text('طاولة غير محددة', 'Table not set')}</bdi></>
        : orderTypeName(order.type, text)}
    </strong>
    <bdi className="order-customer">{order.customerName}</bdi>
    {phone && order.customerPhone && <a className="order-phone" href={`tel:${order.customerPhone}`} aria-label={text(`اتصل بـ ${order.customerName}: ${order.customerPhone}`, `Call ${order.customerName}: ${order.customerPhone}`)}>
      <PhoneIcon size={15} weight="bold" aria-hidden="true" /><span className="ltr">{order.customerPhone}</span>
    </a>}
  </p>;
}

/** What to make: quantity, dish and size, and each line's note; then the order's own note. With prices, a small table under column titles. */
export function OrderLines({ order, prices = false }: { order: OwnerOrder; prices?: boolean }) {
  const { language, number, text } = useLanguage();
  return <>
    {prices && <p className="order-lines-head" aria-hidden="true"><span>{text('الصنف', 'Item')}</span><span>{text('السعر', 'Price')}</span></p>}
    <ul className={`order-lines ${prices ? 'order-lines-priced' : ''}`}>
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

/** Dine-in bills are paid at the table; until then the table shows as occupied. */
export function PaymentBadge({ order }: { order: OwnerOrder }) {
  const { text } = useLanguage();
  if (order.type !== 'DINE_IN' || order.status === 'REJECTED' || order.status === 'CANCELLED') return null;
  return order.paidAt
    ? <span className="badge badge-success">{text('مدفوع', 'Paid')}</span>
    : <span className="badge badge-danger">{text('لسه مدفعش', 'Unpaid')}</span>;
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
  /** Marks a dine-in bill paid, freeing the table. */
  onPaid?: (order: OwnerOrder) => void;
  /** The kitchen screen: what to cook only, without prices, payment or the diner's phone. */
  kitchen?: boolean;
  /** The board shows several branches: say which one the order is for. */
  showBranch?: boolean;
};

/** Which branch an order is for, on boards that show several. */
export function OrderBranch({ order }: { order: OwnerOrder }) {
  const t = useCopy();
  return <p className="order-branch" data-testid="order-branch">
    <StorefrontIcon size={14} weight="bold" aria-hidden="true" />
    <span className="visually-hidden">{t.ordersBranch.branchLabel}: </span><bdi>{order.branchName}</bdi>
  </p>;
}

/**
 * One order on the board, read at a glance from across a kitchen: the number and how long it has
 * waited, where it goes, what to make, the note, and one primary action. A strip on the card's
 * edge carries its column's color; the waiting time turns red once the order is late.
 */
export function OrderCard({ order, now, isNew, onAction, onPaid, kitchen = false, showBranch = false }: Props) {
  const { text, number, language } = useLanguage();
  const minutes = minutesSince(order.placedAt, now);
  const late = minutes >= (LATE_MINUTES[order.status] ?? Infinity);
  const { primary, secondary } = orderActions(order.status);
  const headingId = `order-${order.id}-title`;
  return <article className={`order-card order-card-${order.status.toLowerCase()} ${isNew ? 'is-new' : ''} ${late ? 'is-late' : ''}`} aria-labelledby={headingId} data-testid={`order-${order.number}`}>
    <header className="order-card-head">
      <div className="order-ident">
        <h3 id={headingId} className="order-number"><span className="visually-hidden">{text('طلب', 'Order')} </span><OrderNo number={order.number} /></h3>
        <OrderStatusBadge status={order.status} />
        {order.notifiesDiner && <OrderNotifies ready={order.status === 'READY'} />}
      </div>
      <p className="order-time">
        <time className={`order-age ${late ? 'is-late' : ''}`} dateTime={order.placedAt}>
          <ClockIcon size={13} weight="bold" aria-hidden="true" />{elapsedLabel(minutes, text, number)}
        </time>
        <span className="order-clock">{formatDate(order.placedAt, language, { timeStyle: 'short' })}</span>
      </p>
    </header>
    {showBranch && <OrderBranch order={order} />}
    <OrderWhere order={order} phone={!kitchen} />
    <OrderLines order={order} prices={!kitchen} />
    {!kitchen && <div className="order-bill">
      <p className="order-total"><span>{text('الإجمالي', 'Subtotal')}</span><strong>{formatPrice(order.subtotalPiastres, language)}</strong></p>
      {order.type === 'DINE_IN' && <div className="order-pay">
        <PaymentBadge order={order} />
        {onPaid && !order.paidAt && order.status !== 'PLACED' && <Button small variant="ghost" className="order-paid" onClick={() => onPaid(order)}
          icon={<CheckCircleIcon size={16} weight="bold" aria-hidden="true" />}>{text('الحساب اتدفع', 'Mark paid')}</Button>}
      </div>}
    </div>}
    {(primary || secondary.length > 0) && <footer className="order-actions">
      {primary && <Button className="order-primary" onClick={() => onAction(order, primary)}>{actionName(primary, text)}</Button>}
      {secondary.map(status => <Button key={status} variant={needsReason(status) ? 'danger-outline' : 'secondary'} className="order-secondary" onClick={() => onAction(order, status)}>
        {actionName(status, text)}
      </Button>)}
    </footer>}
  </article>;
}

import { useEffect, useState } from 'react';
import { ArmchairIcon, BagIcon, BellRingingIcon, NoteIcon, PhoneIcon } from '@phosphor-icons/react';
import type { OrderStatus, OwnerOrder } from '@bilhanah/contracts';
import { Button } from '../../../components/Button';
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

/** Dine-in table or pickup customer, with a tap-to-call phone for pickup. */
export function OrderWhere({ order }: { order: OwnerOrder }) {
  const { text } = useLanguage();
  const Icon = order.type === 'DINE_IN' ? ArmchairIcon : BagIcon;
  return <div className={`order-where order-where-${order.type === 'DINE_IN' ? 'dine' : 'pickup'}`}>
    <span className="order-where-icon" aria-hidden="true"><Icon size={20} weight="bold" /></span>
    <div>
      <strong>{orderTypeName(order.type, text)}{order.type === 'DINE_IN' && <> · <span className="order-table">{order.tableLabel ?? text('طاولة غير محددة', 'Table not set')}</span></>}</strong>
      <span className="order-customer">
        {order.customerName}
        {order.customerPhone && <a className="order-phone" href={`tel:${order.customerPhone}`} aria-label={text(`اتصل بـ ${order.customerName}: ${order.customerPhone}`, `Call ${order.customerName}: ${order.customerPhone}`)}>
          <PhoneIcon size={15} weight="bold" aria-hidden="true" /><span className="ltr">{order.customerPhone}</span>
        </a>}
      </span>
    </div>
  </div>;
}

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
            {line.note && <p className="order-line-note"><NoteIcon size={14} weight="bold" aria-hidden="true" /><span className="visually-hidden">{text('ملاحظة:', 'Note:')} </span>{line.note}</p>}
          </div>
          {prices && <span className="order-line-price">{formatPrice(line.lineTotalPiastres, language)}</span>}
        </li>;
      })}
    </ul>
    {order.note && <p className="order-note"><NoteIcon size={17} weight="bold" aria-hidden="true" /><span><strong>{text('ملاحظة الطلب: ', 'Order note: ')}</strong>{order.note}</span></p>}
  </>;
}

/** The diner turned on notifications for this order (the Full Experience plan), so nobody needs to call out their name. */
function OrderNotifies({ ready }: { ready: boolean }) {
  const { text } = useLanguage();
  const label = ready
    ? text('اتبعت للزبون إشعار إن طلبه جاهز', 'The guest was notified that it is ready')
    : text('الزبون هيوصله إشعار أول ما الطلب يجهز', 'The guest gets a notification when it is ready');
  return <span className="order-notifies" title={label}>
    <BellRingingIcon size={15} weight="bold" aria-hidden="true" /><span className="visually-hidden">{label}</span>
  </span>;
}

type Props = {
  order: OwnerOrder;
  now: number;
  isNew: boolean;
  onAction: (order: OwnerOrder, status: OrderStatus) => void;
};

/** One order on the board: number, age, where it goes, what to make, and the next steps. */
export function OrderCard({ order, now, isNew, onAction }: Props) {
  const { text, number, language } = useLanguage();
  const minutes = minutesSince(order.placedAt, now);
  const late = minutes >= (LATE_MINUTES[order.status] ?? Infinity);
  const { primary, secondary } = orderActions(order.status);
  const headingId = `order-${order.id}-title`;
  return <article className={`order-card order-card-${order.status.toLowerCase()} ${isNew ? 'is-new' : ''}`} aria-labelledby={headingId} data-testid={`order-${order.number}`}>
    <header className="order-card-head">
      <h3 id={headingId} className="order-number"><span className="visually-hidden">{text('طلب', 'Order')} </span><OrderNo number={order.number} /></h3>
      <div className="order-card-meta">
        {isNew && <span className="badge badge-guava order-new-flag">{text('جديد', 'New')}</span>}
        {order.status !== 'PLACED' && <OrderStatusBadge status={order.status} />}
        {order.notifiesDiner && <OrderNotifies ready={order.status === 'READY'} />}
        <time className={`order-age ${late ? 'is-late' : ''}`} dateTime={order.placedAt} title={formatDate(order.placedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}>
          {elapsedLabel(minutes, text, number)}<span className="order-clock"> · {formatDate(order.placedAt, language, { timeStyle: 'short' })}</span>
        </time>
      </div>
    </header>
    <OrderWhere order={order} />
    <OrderLines order={order} />
    <div className="order-subtotal"><span>{text('الإجمالي', 'Subtotal')}</span><strong>{formatPrice(order.subtotalPiastres, language)}</strong></div>
    {(primary || secondary.length > 0) && <div className="order-actions">
      {primary && <Button className="order-primary" onClick={() => onAction(order, primary)}>{actionName(primary, text)}</Button>}
      {secondary.map(status => <Button key={status} small variant={needsReason(status) ? 'danger-outline' : 'secondary'} onClick={() => onAction(order, status)}>
        {actionName(status, text)}
      </Button>)}
    </div>}
  </article>;
}

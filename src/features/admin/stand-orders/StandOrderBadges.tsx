import type { AdminStandOrder, StandOrderStatus } from '@bilhanah/contracts';
import { useLanguage } from '../../../lib/language';
import { PAYMENT_METHOD_NAMES, PAYMENT_STATUS_NAMES, STAND_STATUS, standStatusName } from './stand-orders';

export function StandStatusBadge({ status }: { status: StandOrderStatus }) {
  const { text } = useLanguage();
  const tone = STAND_STATUS[status].tone;
  return <span className={`badge ${tone === 'default' ? '' : `badge-${tone}`}`} data-status={status}>{standStatusName(status, text)}</span>;
}

/** "Cash on delivery · Unpaid" */
export function StandPaymentBadge({ order }: { order: Pick<AdminStandOrder, 'paymentMethod' | 'paymentStatus'> }) {
  const { text } = useLanguage();
  return <span className="stand-payment">
    <span>{text(...PAYMENT_METHOD_NAMES[order.paymentMethod])}</span>
    <span className={`badge ${order.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`} data-payment-status={order.paymentStatus}>
      {text(...PAYMENT_STATUS_NAMES[order.paymentStatus])}
    </span>
  </span>;
}

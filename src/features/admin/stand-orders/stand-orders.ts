import {
  STAND_ORDER_STATUSES, STAND_ORDER_TRANSITIONS, type AdminStandOrder, type StandDesign, type StandOrderLine, type StandOrderStatus,
  type StandPaymentMethod, type StandPaymentStatus, type StandPurpose, type StandShape,
} from '@bilhanah/contracts';
import type { StandOrderFilter } from '../../../lib/api/endpoints';

type Text = (ar: string, en: string) => string;
type Label = [ar: string, en: string];

export const STAND_STATUS: Record<StandOrderStatus, { label: Label; tone: 'muted' | 'guava' | 'default' | 'warning' | 'success' | 'danger' }> = {
  AWAITING_PAYMENT: { label: ['مستني الدفع', 'Awaiting payment'], tone: 'muted' },
  NEW: { label: ['جديد', 'New'], tone: 'guava' },
  CONFIRMED: { label: ['اتأكد', 'Confirmed'], tone: 'default' },
  IN_PRODUCTION: { label: ['بيتصنع', 'In production'], tone: 'warning' },
  SHIPPED: { label: ['اتشحن', 'Shipped'], tone: 'default' },
  DELIVERED: { label: ['اتسلّم', 'Delivered'], tone: 'success' },
  CANCELLED: { label: ['اتلغى', 'Cancelled'], tone: 'danger' },
};

export const standStatusName = (status: StandOrderStatus, text: Text) => text(...STAND_STATUS[status].label);

/** What the button that moves an order to `status` says. */
const ACTIONS: Record<StandOrderStatus, Label> = {
  AWAITING_PAYMENT: ['مستني الدفع', 'Awaiting payment'],
  NEW: ['جديد', 'New'],
  CONFIRMED: ['أكّد الطلب', 'Confirm order'],
  IN_PRODUCTION: ['ابدأ التصنيع', 'Start production'],
  SHIPPED: ['سلّمه للشحن', 'Mark shipped'],
  DELIVERED: ['اتسلّم للعميل', 'Mark delivered'],
  CANCELLED: ['إلغاء الطلب', 'Cancel order'],
};

export const standActionName = (status: StandOrderStatus, text: Text) => text(...ACTIONS[status]);

/** The moves an administrator may make now, forward moves first and cancelling last. */
export function nextStatuses(status: StandOrderStatus): StandOrderStatus[] {
  const allowed = [...STAND_ORDER_TRANSITIONS[status]];
  return [...allowed.filter(next => next !== 'CANCELLED'), ...allowed.filter(next => next === 'CANCELLED')];
}

/** Cancelling needs a reason; other moves take an optional note. */
export const needsNote = (status: StandOrderStatus) => status === 'CANCELLED';

/** The queue's filters; "open" (not yet delivered or cancelled) is the default. */
export const STAND_FILTERS: readonly (StandOrderFilter | 'all')[] = ['open', 'NEW', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'AWAITING_PAYMENT', 'CANCELLED', 'all'];

export function filterParam(value: string | null): StandOrderFilter | 'all' {
  if (value === 'all') return 'all';
  return (STAND_ORDER_STATUSES as readonly string[]).includes(value ?? '') ? value as StandOrderStatus : 'open';
}

export function filterName(filter: StandOrderFilter | 'all', text: Text): string {
  if (filter === 'open') return text('مفتوحة', 'Open');
  if (filter === 'all') return text('الكل', 'All');
  return standStatusName(filter, text);
}

export const PAYMENT_METHOD_NAMES: Record<StandPaymentMethod, Label> = {
  CASH_ON_DELIVERY: ['كاش عند الاستلام', 'Cash on delivery'],
  PAYMOB: ['أونلاين (كارت أو محفظة)', 'Online (card or wallet)'],
};

export const PAYMENT_STATUS_NAMES: Record<StandPaymentStatus, Label> = {
  UNPAID: ['لسه ما اتدفعش', 'Unpaid'],
  PAID: ['اتدفع', 'Paid'],
};

/** A cash order still to be paid, not cancelled: the courier's cash can be marked as collected. */
export function canCollectCash(order: Pick<AdminStandOrder, 'paymentMethod' | 'paymentStatus' | 'status'>): boolean {
  return order.paymentMethod === 'CASH_ON_DELIVERY' && order.paymentStatus === 'UNPAID' && order.status !== 'CANCELLED';
}

// Names and colours of the website's stand builder (bilhanah-client-FE: src/features/stand-shop/catalog.ts).
export const SHAPES: Record<StandShape, Label> = { classic: ['كلاسيك', 'Classic'], arch: ['قوس', 'Arch'], tilt: ['مائل', 'Tilt'] };

export const DESIGNS: Record<StandDesign, { label: Label; background: string; ink: string; accent: string }> = {
  signature: { label: ['بصمة', 'Signature'], background: '#FFF8EF', ink: '#075E54', accent: '#FF7868' },
  forest: { label: ['أخضر عميق', 'Deep green'], background: '#075E54', ink: '#FFF8EF', accent: '#FFB49E' },
  clay: { label: ['طين دافي', 'Warm clay'], background: '#F1D6C1', ink: '#4B352B', accent: '#A54B32' },
  mono: { label: ['مينيمال', 'Minimal'], background: '#F7F6F1', ink: '#252B29', accent: '#252B29' },
};

export const PURPOSES: Record<StandPurpose, Label> = {
  menu: ['عرض المنيو', 'Show the menu'],
  reviews: ['تقييمات Google', 'Google reviews'],
  custom: ['لينك على مزاجه', 'Their own link'],
};

/** The colours to print: the custom ones when the customer chose them, otherwise the design's. */
export function printColors(line: Pick<StandOrderLine, 'design' | 'customColors'>): { background: string; ink: string; accent: string; custom: boolean } {
  const design = DESIGNS[line.design];
  return {
    background: line.customColors?.background ?? design.background,
    ink: line.customColors?.ink ?? design.ink,
    accent: design.accent,
    custom: line.customColors !== null,
  };
}

/** Table numbers printed on the stands of a numbered line, e.g. 5–24 for 20 stands from 5. */
export function numberRange(line: Pick<StandOrderLine, 'numbered' | 'startNumber' | 'quantity'>): { from: number; to: number } | null {
  if (!line.numbered) return null;
  return { from: line.startNumber, to: line.startNumber + Math.max(1, line.quantity) - 1 };
}

/** How many stands the order is for. */
export const standCount = (order: Pick<AdminStandOrder, 'lines'>) => order.lines.reduce((sum, line) => sum + line.quantity, 0);

/** A link that is safe to open from the dashboard (http or https only). */
export function safeLink(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** "S-1042-design-2-logo.png" */
export function logoFilename(reference: string, lineNumber: number, type = 'image/png'): string {
  const extension = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
  const slug = reference.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'order';
  return `${slug}-design-${lineNumber}-logo.${extension}`;
}

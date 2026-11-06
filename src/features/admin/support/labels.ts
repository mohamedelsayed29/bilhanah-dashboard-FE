import type { AgentTicketView, SupportNotificationKind, SupportTopic, TicketActivityKind, TicketPriority, TicketStatus } from '@bilhanah/contracts';

type Pair = [string, string];

export const TOPIC_LABELS: Record<SupportTopic, Pair> = {
  GETTING_STARTED: ['البداية', 'Getting started'],
  RESTAURANT_SETUP: ['إعداد المطعم', 'Restaurant setup'],
  MENU: ['المنيو', 'Menu'],
  QR_TABLES: ['QR والطاولات', 'QR & tables'],
  ORDERS: ['الطلبات', 'Orders'],
  PAYMENTS: ['المدفوعات', 'Payments'],
  BRANCHES: ['الفروع', 'Branches'],
  BILLING: ['الاشتراك', 'Billing'],
  ACCOUNT: ['الحساب والصلاحيات', 'Account'],
  TROUBLESHOOTING: ['مشكلة فنية', 'Troubleshooting'],
};

export const STATUS_LABELS: Record<TicketStatus, Pair> = {
  OPEN: ['مفتوحة', 'Open'],
  IN_PROGRESS: ['شغالين عليها', 'In progress'],
  WAITING_FOR_CUSTOMER: ['مستنيين العميل', 'Waiting for customer'],
  RESOLVED: ['اتحلّت', 'Resolved'],
  CLOSED: ['مقفولة', 'Closed'],
};

export const PRIORITY_LABELS: Record<TicketPriority, Pair> = {
  LOW: ['منخفضة', 'Low'],
  NORMAL: ['عادية', 'Normal'],
  HIGH: ['عالية', 'High'],
  URGENT: ['عاجلة', 'Urgent'],
};

export const VIEW_LABELS: Record<AgentTicketView, Pair> = {
  ALL: ['كل التذاكر', 'All tickets'],
  OPEN: STATUS_LABELS.OPEN,
  IN_PROGRESS: STATUS_LABELS.IN_PROGRESS,
  WAITING_FOR_CUSTOMER: STATUS_LABELS.WAITING_FOR_CUSTOMER,
  RESOLVED: STATUS_LABELS.RESOLVED,
  CLOSED: STATUS_LABELS.CLOSED,
  MINE: ['متعيّنة ليا', 'Assigned to me'],
  UNASSIGNED: ['من غير مسؤول', 'Unassigned'],
};

/** The status buttons, in the order an agent usually needs them. */
export const STATUS_ACTIONS: Partial<Record<TicketStatus, Pair>> = {
  IN_PROGRESS: ['ابدأ الشغل عليها', 'Start work'],
  WAITING_FOR_CUSTOMER: ['مستنيين رد العميل', 'Wait for customer'],
  RESOLVED: ['اتحلّت', 'Resolve'],
  CLOSED: ['اقفلها', 'Close'],
  OPEN: ['رجّعها مفتوحة', 'Back to open'],
};

export const NOTIFICATION_LABELS: Record<SupportNotificationKind, Pair> = {
  TICKET_CREATED: ['تذكرة جديدة', 'New ticket'],
  CUSTOMER_REPLIED: ['العميل رد', 'Customer replied'],
  TICKET_ASSIGNED: ['اتعيّنت ليك', 'Assigned to you'],
  NEEDS_ATTENTION: ['محتاجة انتباه', 'Needs attention'],
  AGENT_REPLIED: ['الدعم رد', 'Support replied'],
  STATUS_CHANGED: ['الحالة اتغيرت', 'Status changed'],
  TICKET_RESOLVED: ['اتحلّت', 'Resolved'],
};

/** One line of the ticket's history. */
export function activityLine(kind: TicketActivityKind, from: string | null, to: string | null, text: (ar: string, en: string) => string, name: (id: string | null) => string): string {
  const status = (value: string | null) => (value && value in STATUS_LABELS ? text(...STATUS_LABELS[value as TicketStatus]) : value ?? '');
  const priority = (value: string | null) => (value && value in PRIORITY_LABELS ? text(...PRIORITY_LABELS[value as TicketPriority]) : value ?? '');
  switch (kind) {
    case 'CREATED': return text('فتح التذكرة', 'opened the ticket');
    case 'STATUS': return text(`غيّر الحالة من «${status(from)}» لـ«${status(to)}»`, `changed the status from “${status(from)}” to “${status(to)}”`);
    case 'REOPENED': return text(`فتح التذكرة تاني («${status(to)}»)`, `reopened the ticket (“${status(to)}”)`);
    case 'PRIORITY': return text(`غيّر الأهمية من «${priority(from)}» لـ«${priority(to)}»`, `changed the priority from “${priority(from)}” to “${priority(to)}”`);
    case 'ASSIGNED': return to ? text(`عيّنها لـ${name(to)}`, `assigned it to ${name(to)}`) : text('شال المسؤول عنها', 'unassigned it');
    case 'REPLIED': return text('رد', 'replied');
    case 'NOTE': return text('كتب ملاحظة داخلية', 'added an internal note');
  }
}

/** The page numbers to show: the first, the last, and the current one with its neighbours; gaps as null. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter(value => value >= 1 && value <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((value, index) => (index > 0 && value - sorted[index - 1]! > 1 ? [null, value] : [value]));
}

import { PLAN_CODES, PLAN_NAMES, ROLE_LABELS, STAND_ORDER_STATUSES, type AuditEntry, type PlanCode, type RestaurantRole, type StandOrderStatus } from '@bilhanah/contracts';
import { formatDate, formatPrice } from '../../../lib/format';
import type { Language } from '../../../lib/language';
import { STAND_STATUS } from '../stand-orders/stand-orders';

type Text = (ar: string, en: string) => string;

/** What the entry is about: drives its icon and colour on the page. */
export type AuditCategory = 'restaurant' | 'payment' | 'settings' | 'staff' | 'shop' | 'alert';

type ActionInfo = { label: [ar: string, en: string]; verb: [ar: string, en: string]; category: AuditCategory; tone: 'danger' | 'success' | 'warning' | 'default' };

/**
 * Each action as a name (for badges and filters) and a verb phrase (the sentence "Mona suspended
 * Koshary"). Paymob entries have no person: the payment service recorded them.
 */
const ACTIONS: Record<string, ActionInfo> = {
  'restaurant.suspend': { label: ['إيقاف مطعم', 'Suspended a restaurant'], verb: ['وقّف', 'suspended'], category: 'restaurant', tone: 'danger' },
  'restaurant.unsuspend': { label: ['إرجاع مطعم', 'Unsuspended a restaurant'], verb: ['رجّع', 'restored'], category: 'restaurant', tone: 'success' },
  'entitlement.grant': { label: ['إضافة مدة مدفوعة', 'Granted a paid period'], verb: ['ضاف مدة مدفوعة لـ', 'granted a paid period to'], category: 'payment', tone: 'success' },
  'payment.approve': { label: ['قبول تحويل', 'Approved a payment'], verb: ['قبل تحويل', 'approved a payment from'], category: 'payment', tone: 'success' },
  'payment.reject': { label: ['رفض تحويل', 'Rejected a payment'], verb: ['رفض تحويل', 'rejected a payment from'], category: 'payment', tone: 'danger' },
  'payment.paymob': { label: ['دفع أونلاين', 'Paid online'], verb: ['اتدفع أونلاين اشتراك', 'an online payment came in for'], category: 'payment', tone: 'success' },
  'payment.paymob.duplicate': { label: ['دفع أونلاين مكرر', 'Duplicate online payment'], verb: ['اتدفع مرتين أونلاين اشتراك', 'a duplicate online payment came in for'], category: 'alert', tone: 'warning' },
  'payment.paymob.mismatch': { label: ['مبلغ أونلاين مختلف', 'Online amount mismatch'], verb: ['وصل مبلغ مختلف أونلاين لاشتراك', 'a different amount was paid online for'], category: 'alert', tone: 'danger' },
  'payment.paymob.refunded': { label: ['استرجاع أونلاين', 'Online refund'], verb: ['اترجع دفع أونلاين لاشتراك', 'an online payment was refunded for'], category: 'alert', tone: 'warning' },
  'payment.paymob.voided': { label: ['إلغاء دفع أونلاين', 'Online payment voided'], verb: ['اتلغى دفع أونلاين لاشتراك', 'an online payment was voided for'], category: 'alert', tone: 'warning' },
  'settings.payment': { label: ['تعديل بيانات الدفع', 'Changed payment details'], verb: ['عدّل بيانات الدفع', 'changed the payment details'], category: 'settings', tone: 'warning' },
  'settings.trial': { label: ['تعديل التجربة المجانية', 'Changed trial settings'], verb: ['عدّل التجربة المجانية', 'changed the free trial'], category: 'settings', tone: 'warning' },
  'settings.shop': { label: ['تعديل متجر الستاندات', 'Changed shop settings'], verb: ['عدّل إعدادات متجر الستاندات', 'changed the stand shop settings'], category: 'settings', tone: 'warning' },
  'plan.price': { label: ['تغيير سعر باقة', 'Changed a plan price'], verb: ['غيّر سعر', 'changed the price of'], category: 'settings', tone: 'warning' },
  'stand-order.status': { label: ['تحديث طلب ستاند', 'Updated a stand order'], verb: ['حدّث حالة طلب ستاند', 'updated a stand order'], category: 'shop', tone: 'default' },
  'stand-order.payment': { label: ['دفع طلب ستاند', 'Stand order payment'], verb: ['سجّل دفع طلب ستاند', 'recorded a stand order payment'], category: 'shop', tone: 'success' },
  'stand-order.paymob.duplicate': { label: ['دفع ستاند مكرر', 'Duplicate stand payment'], verb: ['اتدفع مرتين طلب ستاند', 'a stand order was paid twice'], category: 'alert', tone: 'warning' },
  'stand-order.paymob.mismatch': { label: ['مبلغ ستاند مختلف', 'Stand amount mismatch'], verb: ['وصل مبلغ مختلف لطلب ستاند', 'a stand order was paid a different amount'], category: 'alert', tone: 'danger' },
  'stand-order.paymob.refunded': { label: ['استرجاع ستاند', 'Stand refund'], verb: ['اترجع دفع طلب ستاند', 'a stand order payment was refunded'], category: 'alert', tone: 'warning' },
  'stand-order.paymob.voided': { label: ['إلغاء دفع ستاند', 'Stand payment voided'], verb: ['اتلغى دفع طلب ستاند', 'a stand order payment was voided'], category: 'alert', tone: 'warning' },
  'attendance.policy': { label: ['تعديل إعدادات الحضور', 'Attendance settings changed'], verb: ['عدّل إعدادات الحضور في', 'changed attendance settings at'], category: 'staff', tone: 'warning' },
  'attendance.employee_created': { label: ['موظف حضور جديد', 'Employee added'], verb: ['ضاف للحضور الموظف', 'added to attendance'], category: 'staff', tone: 'success' },
  'attendance.employee_updated': { label: ['تعديل موظف حضور', 'Employee edited'], verb: ['عدّل بيانات الموظف', 'edited the employee'], category: 'staff', tone: 'default' },
  'attendance.pin_reset': { label: ['PIN جديد', 'PIN reset'], verb: ['عمل PIN جديد لـ', 'reset the PIN of'], category: 'staff', tone: 'default' },
  'attendance.manual': { label: ['حضور يدوي', 'Manual attendance'], verb: ['سجّل حضور يدوي لـ', 'recorded attendance by hand for'], category: 'staff', tone: 'warning' },
  'attendance.edited': { label: ['تعديل حضور', 'Attendance edited'], verb: ['عدّل حضور', 'edited the attendance of'], category: 'staff', tone: 'warning' },
  'attendance.note': { label: ['ملاحظة على حضور', 'Attendance note'], verb: ['كتب ملاحظة على حضور', 'noted the attendance of'], category: 'staff', tone: 'default' },
  'attendance.correction_approved': { label: ['قبول تصحيح حضور', 'Correction approved'], verb: ['وافق على تصحيح حضور', 'approved the correction for'], category: 'staff', tone: 'success' },
  'attendance.correction_rejected': { label: ['رفض تصحيح حضور', 'Correction rejected'], verb: ['رفض تصحيح حضور', 'rejected the correction for'], category: 'staff', tone: 'danger' },
  'attendance.kiosk_created': { label: ['كشك حضور جديد', 'Kiosk created'], verb: ['عمل كشك حضور', 'created an attendance kiosk'], category: 'staff', tone: 'success' },
  'attendance.kiosk_disabled': { label: ['قفل كشك', 'Kiosk disabled'], verb: ['قفل كشك الحضور', 'disabled an attendance kiosk'], category: 'staff', tone: 'danger' },
  'attendance.kiosk_enabled': { label: ['فتح كشك', 'Kiosk enabled'], verb: ['فتح كشك الحضور', 'enabled an attendance kiosk'], category: 'staff', tone: 'success' },
  'staff.created': { label: ['حساب موظف جديد', 'Staff account created'], verb: ['عمل حساب للموظف', 'created a staff account for'], category: 'staff', tone: 'success' },
  'staff.updated': { label: ['تعديل موظف', 'Staff account edited'], verb: ['عدّل بيانات الموظف', 'edited the staff account of'], category: 'staff', tone: 'default' },
  'staff.role_changed': { label: ['تغيير دور', 'Role changed'], verb: ['غيّر دور', 'changed the role of'], category: 'staff', tone: 'warning' },
  'staff.permissions_changed': { label: ['تغيير صلاحيات', 'Permissions changed'], verb: ['غيّر صلاحيات', 'changed the permissions of'], category: 'staff', tone: 'warning' },
  'staff.activated': { label: ['تشغيل حساب', 'Account turned on'], verb: ['شغّل حساب', 'turned on the account of'], category: 'staff', tone: 'success' },
  'staff.deactivated': { label: ['إيقاف حساب', 'Account turned off'], verb: ['وقّف حساب', 'turned off the account of'], category: 'staff', tone: 'danger' },
  'staff.password_reset': { label: ['كلمة سر جديدة', 'Password reset'], verb: ['غيّر كلمة سر', 'set a new password for'], category: 'staff', tone: 'default' },
  'staff.deleted': { label: ['مسح موظف', 'Staff account deleted'], verb: ['مسح حساب', 'deleted the account of'], category: 'staff', tone: 'danger' },
};

/** A readable name for an audit action; unknown actions show as recorded. */
export function auditActionLabel(action: string, text: Text): string {
  const info = ACTIONS[action];
  return info ? text(...info.label) : action;
}

/** The action as a verb phrase for a sentence; unknown actions show as recorded. */
export function auditVerb(action: string, text: Text): string {
  const info = ACTIONS[action];
  return info ? text(...info.verb) : action;
}

export function auditCategory(action: string): AuditCategory {
  return ACTIONS[action]?.category ?? (action.startsWith('staff.') ? 'staff' : action.startsWith('settings.') ? 'settings' : 'restaurant');
}

/** Tone of the action's badge. */
export function auditTone(action: string): 'danger' | 'success' | 'warning' | 'muted' | 'default' {
  return ACTIONS[action]?.tone ?? 'default';
}

const PAYMENT_FIELD_LABELS: Record<string, [ar: string, en: string]> = {
  instapayAddress: ['عنوان إنستاباي', 'InstaPay address'],
  vodafoneCashNumber: ['فودافون كاش', 'Vodafone Cash'],
  bankName: ['البنك', 'Bank'],
  bankAccountName: ['اسم الحساب', 'Account name'],
  bankAccountNumber: ['رقم الحساب', 'Account number'],
  notesAr: ['ملاحظات بالعربي', 'Arabic notes'],
  notesEn: ['ملاحظات بالإنجليزي', 'English notes'],
};

const isPlan = (value: unknown): value is PlanCode => typeof value === 'string' && (PLAN_CODES as readonly string[]).includes(value);
const isRole = (value: unknown): value is RestaurantRole => typeof value === 'string' && value in ROLE_LABELS;
const isStandStatus = (value: unknown): value is StandOrderStatus => typeof value === 'string' && (STAND_ORDER_STATUSES as readonly string[]).includes(value);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const shorten = (value: string, max = 60) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

const digits = (value: number, language: Language) => new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-EG').format(value);

function monthsText(months: unknown, text: Text, language: Language): string | null {
  if (typeof months !== 'number') return null;
  const n = digits(months, language);
  return text(months === 1 ? 'شهر' : months === 2 ? 'شهرين' : months <= 10 ? `${n} شهور` : `${n} شهر`, `${months} month${months === 1 ? '' : 's'}`);
}

/** "Waiter", "Cashier"…, or a list of permissions as recorded (staff changes). */
function roleOrValue(value: unknown, text: Text): string {
  if (value === null || value === undefined || value === '') return text('ولا حاجة', 'none');
  if (isRole(value)) return text(...ROLE_LABELS[value]);
  return String(value);
}

/** The person or thing a staff change was about (shown bold in the sentence). */
export function auditSubject(entry: Pick<AuditEntry, 'action' | 'metadata'>): string | null {
  const data = record(entry.metadata);
  if (entry.action.startsWith('attendance.')) return typeof data['employeeName'] === 'string' ? data['employeeName'] : typeof data['kioskName'] === 'string' ? data['kioskName'] : null;
  const name = data['targetName'];
  return entry.action.startsWith('staff.') && typeof name === 'string' ? name : null;
}

/** The key facts recorded with an entry, as short translated lines. */
export function auditDetails(entry: Pick<AuditEntry, 'action' | 'metadata'>, text: Text, language: Language): string[] {
  const data = record(entry.metadata);
  const plan = isPlan(data['planCode']) ? text(PLAN_NAMES[data['planCode']].ar, PLAN_NAMES[data['planCode']].en) : null;
  const until = typeof data['endsAt'] === 'string' ? text(`لحد ${formatDate(data['endsAt'], language)}`, `until ${formatDate(data['endsAt'], language)}`) : null;
  const reason = typeof data['reason'] === 'string' ? text(`السبب: ${data['reason']}`, `Reason: ${data['reason']}`) : null;
  const money = (key: string) => (typeof data[key] === 'number' ? formatPrice(data[key], language) : null);
  switch (entry.action) {
    case 'restaurant.suspend':
    case 'payment.reject':
      return reason ? [reason] : [];
    case 'restaurant.unsuspend':
      return [];
    case 'entitlement.grant':
    case 'payment.approve':
    case 'payment.paymob': {
      const lines = [[plan, monthsText(data['months'], text, language), until].filter(Boolean).join(' · ')].filter(Boolean);
      if (typeof data['note'] === 'string') lines.push(text(`ملاحظة: ${data['note']}`, `Note: ${data['note']}`));
      return lines;
    }
    case 'settings.payment':
      return Object.entries(data).filter(([key]) => key in PAYMENT_FIELD_LABELS).map(([key, value]) => {
        const label = text(...PAYMENT_FIELD_LABELS[key]!);
        return typeof value === 'string' && value !== '' ? `${label}: ${shorten(value)}` : text(`${label}: اتمسح`, `${label}: cleared`);
      });
    case 'settings.trial': {
      const lines: string[] = [];
      if (typeof data['enabled'] === 'boolean') lines.push(data['enabled'] ? text('التجربة: شغالة', 'Trial: on') : text('التجربة: متوقفة', 'Trial: off'));
      if (typeof data['durationDays'] === 'number') lines.push(text(`المدة: ${digits(data['durationDays'], language)} يوم`, `Length: ${data['durationDays']} days`));
      if (plan) lines.push(text(`الباقة: ${plan}`, `Plan: ${plan}`));
      return lines;
    }
    case 'settings.shop': {
      const to = record(data['to']);
      const lines: string[] = [];
      if ('deliveryFeePiastres' in to) lines.push(to['deliveryFeePiastres'] === null ? text('التوصيل: بالتليفون', 'Delivery: by phone') : text(`التوصيل: ${formatPrice(Number(to['deliveryFeePiastres']), language)}`, `Delivery: ${formatPrice(Number(to['deliveryFeePiastres']), language)}`));
      if (typeof to['cashOnDelivery'] === 'boolean') lines.push(to['cashOnDelivery'] ? text('كاش عند الاستلام: شغال', 'Cash on delivery: on') : text('كاش عند الاستلام: مقفول', 'Cash on delivery: off'));
      if (typeof to['onlinePayment'] === 'boolean') lines.push(to['onlinePayment'] ? text('الدفع الأونلاين: شغال', 'Online payment: on') : text('الدفع الأونلاين: مقفول', 'Online payment: off'));
      return lines;
    }
    case 'plan.price':
      return typeof data['from'] === 'number' && typeof data['to'] === 'number' ? [`${formatPrice(data['from'], language)} → ${formatPrice(data['to'], language)}`] : [];
    case 'stand-order.status': {
      const lines = isStandStatus(data['from']) && isStandStatus(data['to']) ? [`${text(...STAND_STATUS[data['from']].label)} → ${text(...STAND_STATUS[data['to']].label)}`] : [];
      if (typeof data['note'] === 'string' && data['note']) lines.push(text(`ملاحظة: ${data['note']}`, `Note: ${data['note']}`));
      return lines;
    }
    case 'stand-order.payment':
      return typeof data['paymentStatus'] === 'string' ? [text(`الدفع: ${data['paymentStatus'] === 'PAID' ? 'اتدفع' : 'مش مدفوع'}`, `Payment: ${data['paymentStatus'] === 'PAID' ? 'paid' : 'unpaid'}`)] : [];
    case 'payment.paymob.mismatch':
    case 'stand-order.paymob.mismatch':
      return [text(`اتدفع ${money('paid') ?? '—'} بدل ${money('expected') ?? '—'}`, `Paid ${money('paid') ?? '—'} instead of ${money('expected') ?? '—'}`)];
    case 'payment.paymob.duplicate':
    case 'payment.paymob.refunded':
    case 'payment.paymob.voided':
    case 'stand-order.paymob.duplicate':
    case 'stand-order.paymob.refunded':
    case 'stand-order.paymob.voided':
      return money('amountPiastres') ? [text(`المبلغ: ${money('amountPiastres')}`, `Amount: ${money('amountPiastres')}`)] : [];
    case 'attendance.manual':
    case 'attendance.edited':
    case 'attendance.correction_approved':
    case 'attendance.correction_rejected': {
      const span = (value: unknown) => (typeof value === 'string' ? value.split(' → ').map(part => (part === '—' ? '—' : formatDate(part, language, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))).join(' → ') : null);
      return [span(data['from']) && span(data['to']) ? `${span(data['from'])} ⟶ ${span(data['to'])}` : span(data['to']), typeof data['reason'] === 'string' ? text(`السبب: ${data['reason']}`, `Reason: ${data['reason']}`) : null,
        typeof data['note'] === 'string' && data['note'] ? text(`ملاحظة: ${data['note']}`, `Note: ${data['note']}`) : null].filter((line): line is string => Boolean(line));
    }
    case 'attendance.policy':
      return Array.isArray(data['methods']) ? [text(`الطرق: ${(data['methods'] as string[]).join('، ')}`, `Methods: ${(data['methods'] as string[]).join(', ')}`)] : data['inherits'] ? [text('الفرع رجع لإعدادات المطعم', 'Branch follows the restaurant again')] : [];
    case 'attendance.note':
      return typeof data['note'] === 'string' ? [text(`ملاحظة: ${data['note']}`, `Note: ${data['note']}`)] : [];
    case 'attendance.employee_created':
    case 'attendance.employee_updated':
    case 'attendance.pin_reset':
    case 'attendance.kiosk_created':
    case 'attendance.kiosk_disabled':
    case 'attendance.kiosk_enabled':
      return [];
    case 'staff.created':
      return data['to'] ? [text(`الدور: ${roleOrValue(data['to'], text)}`, `Role: ${roleOrValue(data['to'], text)}`)] : [];
    case 'staff.role_changed':
    case 'staff.permissions_changed':
      return [`${roleOrValue(data['from'], text)} → ${roleOrValue(data['to'], text)}`];
    case 'staff.deleted':
      return isRole(data['from']) ? [text(`كان: ${roleOrValue(data['from'], text)}`, `Was: ${roleOrValue(data['from'], text)}`)] : [];
    case 'staff.updated':
    case 'staff.activated':
    case 'staff.deactivated':
    case 'staff.password_reset':
      return isRole(data['targetRole']) ? [text(`الدور: ${roleOrValue(data['targetRole'], text)}`, `Role: ${roleOrValue(data['targetRole'], text)}`)] : [];
    default:
      return entry.metadata === null || entry.metadata === undefined ? [] : [shorten(JSON.stringify(entry.metadata), 120)];
  }
}

export type AuditTarget =
  | { kind: 'restaurant'; id: string }
  | { kind: 'payment'; id: string; restaurantId: string | null }
  | { kind: 'plan'; code: PlanCode }
  | { kind: 'settings'; section: 'payment' | 'trial' | 'shop' | 'plans' }
  | { kind: 'stand-order'; id: string }
  | { kind: 'staff' }
  | { kind: 'other'; label: string };

/** What an entry acted on, so the page can link to it. */
export function auditTarget(entry: Pick<AuditEntry, 'action' | 'targetType' | 'targetId' | 'metadata'>): AuditTarget {
  const restaurantId = record(entry.metadata)['restaurantId'];
  if (entry.targetType === 'restaurant' && entry.targetId) return { kind: 'restaurant', id: entry.targetId };
  if (entry.targetType === 'payment' && entry.targetId) return { kind: 'payment', id: entry.targetId, restaurantId: typeof restaurantId === 'string' ? restaurantId : null };
  if (entry.targetType === 'plan' && isPlan(entry.targetId)) return { kind: 'plan', code: entry.targetId };
  if (entry.targetType === 'settings') return { kind: 'settings', section: entry.action === 'settings.trial' ? 'trial' : entry.action === 'settings.shop' ? 'shop' : 'payment' };
  if (entry.targetType === 'stand-order' && entry.targetId) return { kind: 'stand-order', id: entry.targetId };
  if (entry.targetType === 'staff' || entry.action.startsWith('attendance.')) return { kind: 'staff' };
  return { kind: 'other', label: [entry.targetType, entry.targetId].filter(Boolean).join(' ') };
}

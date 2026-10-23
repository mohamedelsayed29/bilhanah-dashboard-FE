import { PLAN_CODES, PLAN_NAMES, type AuditEntry, type PlanCode } from '@bilhanah/contracts';
import { formatDate, formatPrice } from '../../../lib/format';
import type { Language } from '../../../lib/language';

type Text = (ar: string, en: string) => string;

const ACTIONS: Record<string, [ar: string, en: string]> = {
  'restaurant.suspend': ['إيقاف مطعم', 'Suspended a restaurant'],
  'restaurant.unsuspend': ['إرجاع مطعم', 'Unsuspended a restaurant'],
  'entitlement.grant': ['إضافة مدة مدفوعة', 'Granted a paid period'],
  'payment.approve': ['قبول تحويل', 'Approved a payment'],
  'payment.reject': ['رفض تحويل', 'Rejected a payment'],
  'settings.payment': ['تعديل بيانات الدفع', 'Changed payment details'],
  'settings.trial': ['تعديل التجربة المجانية', 'Changed trial settings'],
  'plan.price': ['تغيير سعر باقة', 'Changed a plan price'],
};

/** A readable name for an audit action; unknown actions show as recorded. */
export function auditActionLabel(action: string, text: Text): string {
  const label = ACTIONS[action];
  return label ? text(...label) : action;
}

/** Tone of the action's badge. */
export function auditTone(action: string): 'danger' | 'success' | 'warning' | 'muted' | 'default' {
  if (action === 'restaurant.suspend' || action === 'payment.reject') return 'danger';
  if (action === 'payment.approve' || action === 'entitlement.grant' || action === 'restaurant.unsuspend') return 'success';
  if (action.startsWith('settings.') || action.startsWith('plan.')) return 'warning';
  return 'default';
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
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const shorten = (value: string, max = 60) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

const digits = (value: number, language: Language) => new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-EG').format(value);

function monthsText(months: unknown, text: Text, language: Language): string | null {
  if (typeof months !== 'number') return null;
  const n = digits(months, language);
  return text(months === 1 ? 'شهر' : months === 2 ? 'شهرين' : months <= 10 ? `${n} شهور` : `${n} شهر`, `${months} month${months === 1 ? '' : 's'}`);
}

/** The key facts recorded with an entry, as short translated lines. */
export function auditDetails(entry: Pick<AuditEntry, 'action' | 'metadata'>, text: Text, language: Language): string[] {
  const data = record(entry.metadata);
  const plan = isPlan(data['planCode']) ? text(PLAN_NAMES[data['planCode']].ar, PLAN_NAMES[data['planCode']].en) : null;
  const until = typeof data['endsAt'] === 'string' ? text(`لحد ${formatDate(data['endsAt'], language)}`, `until ${formatDate(data['endsAt'], language)}`) : null;
  const reason = typeof data['reason'] === 'string' ? text(`السبب: ${data['reason']}`, `Reason: ${data['reason']}`) : null;
  switch (entry.action) {
    case 'restaurant.suspend':
    case 'payment.reject':
      return reason ? [reason] : [];
    case 'restaurant.unsuspend':
      return [];
    case 'entitlement.grant':
    case 'payment.approve': {
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
    case 'plan.price':
      return typeof data['from'] === 'number' && typeof data['to'] === 'number' ? [`${formatPrice(data['from'], language)} → ${formatPrice(data['to'], language)}`] : [];
    default:
      return entry.metadata === null || entry.metadata === undefined ? [] : [shorten(JSON.stringify(entry.metadata), 120)];
  }
}

export type AuditTarget =
  | { kind: 'restaurant'; id: string }
  | { kind: 'payment'; id: string; restaurantId: string | null }
  | { kind: 'plan'; code: PlanCode }
  | { kind: 'settings' }
  | { kind: 'other'; label: string };

/** What an entry acted on, so the page can link to it. */
export function auditTarget(entry: Pick<AuditEntry, 'targetType' | 'targetId' | 'metadata'>): AuditTarget {
  const restaurantId = record(entry.metadata)['restaurantId'];
  if (entry.targetType === 'restaurant' && entry.targetId) return { kind: 'restaurant', id: entry.targetId };
  if (entry.targetType === 'payment' && entry.targetId) return { kind: 'payment', id: entry.targetId, restaurantId: typeof restaurantId === 'string' ? restaurantId : null };
  if (entry.targetType === 'plan' && isPlan(entry.targetId)) return { kind: 'plan', code: entry.targetId };
  if (entry.targetType === 'settings') return { kind: 'settings' };
  return { kind: 'other', label: [entry.targetType, entry.targetId].filter(Boolean).join(' ') };
}

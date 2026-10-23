import type { PlanCode, RestaurantAccess } from '@bilhanah/contracts';
import { daysUntil } from '../../lib/format';
import { useLanguage } from '../../lib/language';

export const PLAN_NAMES: Record<PlanCode, [ar: string, en: string]> = {
  MENU: ['منيو', 'Menu'],
  ORDERS: ['منيو وطلبات', 'Menu & Orders'],
  ADVANCED: ['التجربة الكاملة', 'The Full Experience'],
};

/** Days left in the trial or paid period, when there is one. */
export function accessDaysLeft(access: RestaurantAccess, now = Date.now()): number | null {
  const end = access.status === 'TRIAL' ? access.trialEndsAt : access.status === 'PAID' ? access.currentPeriodEndsAt : null;
  return end ? daysUntil(end, now) : null;
}

export function useAccessLabel(access: RestaurantAccess): string {
  const { text, number } = useLanguage();
  const days = accessDaysLeft(access);
  switch (access.status) {
    case 'TRIAL':
      return days === null ? text('تجربة مجانية', 'Free trial') : text(`تجربة مجانية · فاضل ${number(days)} يوم`, `Free trial · ${days} day${days === 1 ? '' : 's'} left`);
    case 'PAID':
      return access.planCode ? text(`باقة ${PLAN_NAMES[access.planCode][0]}`, `${PLAN_NAMES[access.planCode][1]} plan`) : text('اشتراك فعّال', 'Active plan');
    case 'INACTIVE':
      return text('الاشتراك مش فعّال', 'Subscription inactive');
    case 'SUSPENDED':
      return text('موقوف', 'Suspended');
  }
}

export function AccessBadge({ access, inverse = false }: { access: RestaurantAccess; inverse?: boolean }) {
  const label = useAccessLabel(access);
  const tone = access.status === 'TRIAL' ? 'guava' : access.status === 'PAID' ? 'success' : access.status === 'INACTIVE' ? 'warning' : 'danger';
  return <span className={`badge badge-${tone} ${inverse ? 'badge-on-dark' : ''}`}>{label}</span>;
}

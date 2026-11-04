import { describe, expect, it } from 'vitest';
import { auditActionLabel, auditDetails, auditSubject, auditTarget, auditVerb } from './audit-labels';

const en = (_ar: string, english: string) => english;
const ar = (arabic: string) => arabic;

describe('auditActionLabel', () => {
  it('translates known actions and keeps unknown ones as recorded', () => {
    expect(auditActionLabel('payment.approve', en)).toBe('Approved a payment');
    expect(auditActionLabel('payment.approve', ar)).toBe('قبول تحويل');
    expect(auditActionLabel('plan.price', en)).toBe('Changed a plan price');
    expect(auditActionLabel('something.new', en)).toBe('something.new');
  });
});

describe('auditDetails', () => {
  it('summarises approvals and grants', () => {
    expect(auditDetails({ action: 'payment.approve', metadata: { restaurantId: 'r1', planCode: 'MENU', months: 3, endsAt: '2027-02-10T09:00:00.000Z' } }, en, 'en'))
      .toEqual(['Menu · 3 months · until Feb 10, 2027']);
    expect(auditDetails({ action: 'entitlement.grant', metadata: { planCode: 'ADVANCED', months: 1, note: 'Cash at the office', endsAt: '2026-12-01T12:00:00.000Z' } }, en, 'en'))
      .toEqual(['The Full Experience · 1 month · until Dec 1, 2026', 'Note: Cash at the office']);
  });

  it('shows reasons, price changes and trial changes', () => {
    expect(auditDetails({ action: 'payment.reject', metadata: { restaurantId: 'r1', reason: 'No transfer arrived' } }, en, 'en')).toEqual(['Reason: No transfer arrived']);
    expect(auditDetails({ action: 'restaurant.suspend', metadata: { reason: 'Fraud' } }, ar, 'ar')).toEqual(['السبب: Fraud']);
    expect(auditDetails({ action: 'restaurant.unsuspend', metadata: null }, en, 'en')).toEqual([]);
    expect(auditDetails({ action: 'plan.price', metadata: { from: 20000, to: 25050 } }, en, 'en')).toEqual(['EGP\u00a0200 → EGP\u00a0250.5']);
    expect(auditDetails({ action: 'settings.trial', metadata: { enabled: false, durationDays: 14, planCode: 'ORDERS' } }, en, 'en'))
      .toEqual(['Trial: off', 'Length: 14 days', 'Plan: Menu & Orders']);
  });

  it('reads staff changes and online payment problems as words, never raw data', () => {
    const created = { action: 'staff.created', metadata: { to: 'WAITER', branchId: null, targetName: 'سامي الويتر', targetRole: 'WAITER' } };
    expect(auditDetails(created, en, 'en')).toEqual(['Role: Waiter']);
    expect(auditSubject(created)).toBe('سامي الويتر');
    expect(auditVerb('staff.created', ar)).toBe('عمل حساب للموظف');
    expect(auditDetails({ action: 'staff.role_changed', metadata: { from: 'WAITER', to: 'CASHIER' } }, en, 'en')).toEqual(['Waiter → Cashier']);
    expect(auditDetails({ action: 'staff.permissions_changed', metadata: { from: null, to: 'payments.refund' } }, en, 'en')).toEqual(['none → payments.refund']);
    expect(auditDetails({ action: 'payment.paymob.mismatch', metadata: { paid: 10000, expected: 25000 } }, en, 'en')).toEqual(['Paid EGP\u00a0100 instead of EGP\u00a0250']);
    expect(auditDetails({ action: 'stand-order.status', metadata: { from: 'NEW', to: 'SHIPPED', note: null } }, en, 'en')).toEqual(['New → Shipped']);
  });

  it('lists changed payment fields, marking cleared ones', () => {
    expect(auditDetails({ action: 'settings.payment', metadata: { instapayAddress: 'bilhanah@instapay', vodafoneCashNumber: null } }, en, 'en'))
      .toEqual(['InstaPay address: bilhanah@instapay', 'Vodafone Cash: cleared']);
  });
});

describe('auditTarget', () => {
  it('links restaurants, payments (with their restaurant), plans and settings', () => {
    expect(auditTarget({ action: 'restaurant.suspend', targetType: 'restaurant', targetId: 'r1', metadata: null })).toEqual({ kind: 'restaurant', id: 'r1' });
    expect(auditTarget({ action: 'payment.approve', targetType: 'payment', targetId: 'p1', metadata: { restaurantId: 'r1' } })).toEqual({ kind: 'payment', id: 'p1', restaurantId: 'r1' });
    expect(auditTarget({ action: 'plan.price', targetType: 'plan', targetId: 'MENU', metadata: {} })).toEqual({ kind: 'plan', code: 'MENU' });
    expect(auditTarget({ action: 'settings.trial', targetType: 'settings', targetId: null, metadata: {} })).toEqual({ kind: 'settings', section: 'trial' });
    expect(auditTarget({ action: 'stand-order.status', targetType: 'stand-order', targetId: 's1', metadata: {} })).toEqual({ kind: 'stand-order', id: 's1' });
  });
});

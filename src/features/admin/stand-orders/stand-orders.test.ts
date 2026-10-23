import { describe, expect, it } from 'vitest';
import { STAND_ORDER_STATUSES } from '@bilhanah/contracts';
import {
  canCollectCash, filterName, filterParam, logoFilename, needsNote, nextStatuses, numberRange, printColors, safeLink, standActionName, standCount, standStatusName,
} from './stand-orders';

const en = (_: string, english: string) => english;
const ar = (arabic: string) => arabic;

describe('nextStatuses', () => {
  it('follows the contract’s transitions, with cancelling last', () => {
    expect(nextStatuses('NEW')).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(nextStatuses('CONFIRMED')).toEqual(['IN_PRODUCTION', 'CANCELLED']);
    expect(nextStatuses('IN_PRODUCTION')).toEqual(['SHIPPED', 'CANCELLED']);
    expect(nextStatuses('SHIPPED')).toEqual(['DELIVERED']);
    expect(nextStatuses('AWAITING_PAYMENT')).toEqual(['CANCELLED']);
    expect(nextStatuses('DELIVERED')).toEqual([]);
    expect(nextStatuses('CANCELLED')).toEqual([]);
  });

  it('asks for a reason only to cancel', () => {
    expect(needsNote('CANCELLED')).toBe(true);
    expect(needsNote('CONFIRMED')).toBe(false);
  });
});

describe('labels', () => {
  it('names every status and action in both languages', () => {
    for (const status of STAND_ORDER_STATUSES) {
      expect(standStatusName(status, ar)).toMatch(/[؀-ۿ]/);
      expect(standStatusName(status, en)).toMatch(/^[A-Z]/);
      expect(standActionName(status, en)).not.toBe('');
    }
  });
});

describe('filterParam', () => {
  it('defaults to open orders and accepts statuses and all', () => {
    expect(filterParam(null)).toBe('open');
    expect(filterParam('nonsense')).toBe('open');
    expect(filterParam('NEW')).toBe('NEW');
    expect(filterParam('all')).toBe('all');
    expect(filterName('open', en)).toBe('Open');
    expect(filterName('SHIPPED', en)).toBe('Shipped');
  });
});

describe('canCollectCash', () => {
  it('only for unpaid cash orders that are not cancelled', () => {
    expect(canCollectCash({ paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'UNPAID', status: 'SHIPPED' })).toBe(true);
    expect(canCollectCash({ paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'PAID', status: 'DELIVERED' })).toBe(false);
    expect(canCollectCash({ paymentMethod: 'PAYMOB', paymentStatus: 'UNPAID', status: 'AWAITING_PAYMENT' })).toBe(false);
    expect(canCollectCash({ paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'UNPAID', status: 'CANCELLED' })).toBe(false);
  });
});

describe('printColors', () => {
  it('uses the design’s colours unless the customer chose their own', () => {
    expect(printColors({ design: 'forest', customColors: null })).toEqual({ background: '#075E54', ink: '#FFF8EF', accent: '#FFB49E', custom: false });
    expect(printColors({ design: 'forest', customColors: { background: '#112233', ink: '#FFFFFF' } })).toMatchObject({ background: '#112233', ink: '#FFFFFF', custom: true });
  });
});

describe('numberRange', () => {
  it('gives the printed table numbers of a numbered line', () => {
    expect(numberRange({ numbered: true, startNumber: 5, quantity: 20 })).toEqual({ from: 5, to: 24 });
    expect(numberRange({ numbered: true, startNumber: 1, quantity: 1 })).toEqual({ from: 1, to: 1 });
    expect(numberRange({ numbered: false, startNumber: 1, quantity: 10 })).toBeNull();
  });
});

describe('standCount', () => {
  it('adds up the quantities of every line', () => {
    expect(standCount({ lines: [{ quantity: 3 }, { quantity: 12 }] as never })).toBe(15);
  });
});

describe('safeLink', () => {
  it('opens web links only', () => {
    expect(safeLink('https://g.page/r/abc/review')).toBe('https://g.page/r/abc/review');
    expect(safeLink('javascript:alert(1)')).toBeNull();
    expect(safeLink('nope')).toBeNull();
  });
});

describe('logoFilename', () => {
  it('names the download after the order and design', () => {
    expect(logoFilename('S-1042', 2)).toBe('S-1042-design-2-logo.png');
    expect(logoFilename('S 7/1', 1, 'image/jpeg')).toBe('S-7-1-design-1-logo.jpg');
  });
});

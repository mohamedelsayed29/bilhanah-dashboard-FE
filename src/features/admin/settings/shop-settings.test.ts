import { describe, expect, it } from 'vitest';
import { fromShopForm, onlineHidden, toShopForm, type ShopForm } from './shop-settings';

const form = (changes: Partial<ShopForm> = {}): ShopForm => ({ feeMode: 'fixed', fee: '60', cashOnDelivery: true, onlinePayment: true, ...changes });

describe('shop settings form', () => {
  it('round-trips the API settings', () => {
    expect(toShopForm({ deliveryFeePiastres: 6050, cashOnDelivery: true, onlinePayment: false })).toEqual({ feeMode: 'fixed', fee: '60.5', cashOnDelivery: true, onlinePayment: false });
    expect(toShopForm({ deliveryFeePiastres: null, cashOnDelivery: true, onlinePayment: true }).feeMode).toBe('phone');
    expect(fromShopForm(form({ fee: '٦٠٫٥' }))).toEqual({ settings: { deliveryFeePiastres: 6050, cashOnDelivery: true, onlinePayment: true } });
    expect(fromShopForm(form({ fee: '0' }))).toEqual({ settings: { deliveryFeePiastres: 0, cashOnDelivery: true, onlinePayment: true } });
  });

  it('saves null when the fee is confirmed by phone', () => {
    expect(fromShopForm(form({ feeMode: 'phone', fee: 'ignored' }))).toEqual({ settings: { deliveryFeePiastres: null, cashOnDelivery: true, onlinePayment: true } });
  });

  it('rejects a bad fee', () => {
    expect(fromShopForm(form({ fee: '' }))).toEqual({ problem: 'fee' });
    expect(fromShopForm(form({ fee: 'abc' }))).toEqual({ problem: 'fee' });
    expect(fromShopForm(form({ fee: '1000.01' }))).toEqual({ problem: 'fee' });
    expect(fromShopForm(form({ fee: '1000' }))).toMatchObject({ settings: { deliveryFeePiastres: 100_000 } });
  });

  it('needs at least one way to pay', () => {
    expect(fromShopForm(form({ cashOnDelivery: false, onlinePayment: false }))).toEqual({ problem: 'none' });
  });

  it('refuses online-only while the fee is confirmed by phone (the website would offer no way to pay)', () => {
    expect(fromShopForm(form({ feeMode: 'phone', cashOnDelivery: false, onlinePayment: true }))).toEqual({ problem: 'online-needs-fee' });
    expect(onlineHidden(form({ feeMode: 'phone' }))).toBe(true);
    expect(onlineHidden(form())).toBe(false);
  });
});

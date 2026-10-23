import { shopSettingsSchema, type ShopSettings } from '@bilhanah/contracts';
import { egpToPiastres, piastresToInput } from '../../../lib/format';

/** The form: a fixed delivery fee typed in EGP, or "confirmed by phone" (null). */
export type ShopForm = { feeMode: 'fixed' | 'phone'; fee: string; cashOnDelivery: boolean; onlinePayment: boolean };

export type ShopProblem = 'fee' | 'none' | 'online-needs-fee';

export function toShopForm(settings: ShopSettings): ShopForm {
  return {
    feeMode: settings.deliveryFeePiastres === null ? 'phone' : 'fixed',
    fee: settings.deliveryFeePiastres === null ? '' : piastresToInput(settings.deliveryFeePiastres),
    cashOnDelivery: settings.cashOnDelivery,
    onlinePayment: settings.onlinePayment,
  };
}

/**
 * The settings to save, or what is wrong:
 * - fee: not an amount between 0 and EGP 1,000 (the API's limit);
 * - none: no way to pay is switched on;
 * - online-needs-fee: only online payment is on, but the website hides it while the fee is confirmed
 *   by phone, so customers could not pay at all.
 */
export function fromShopForm(form: ShopForm): { settings: ShopSettings } | { problem: ShopProblem } {
  let deliveryFeePiastres: number | null = null;
  if (form.feeMode === 'fixed') {
    const piastres = egpToPiastres(form.fee);
    if (piastres === null || piastres > 100_000) return { problem: 'fee' };
    deliveryFeePiastres = piastres;
  }
  if (!form.cashOnDelivery && !form.onlinePayment) return { problem: 'none' };
  if (deliveryFeePiastres === null && !form.cashOnDelivery) return { problem: 'online-needs-fee' };
  const settings = { deliveryFeePiastres, cashOnDelivery: form.cashOnDelivery, onlinePayment: form.onlinePayment };
  const parsed = shopSettingsSchema.safeParse(settings);
  return parsed.success ? { settings: parsed.data } : { problem: 'fee' };
}

/** Online payment shows on the website only with a fixed fee. */
export const onlineHidden = (form: ShopForm) => form.onlinePayment && form.feeMode === 'phone';

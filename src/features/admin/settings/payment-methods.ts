import type { PaymentInstructions } from '@bilhanah/contracts';

export type PaymentMethod = 'instapay' | 'vodafone' | 'bank';

type Fields = Partial<Record<keyof PaymentInstructions, string | null | undefined>>;
const filled = (value: string | null | undefined) => typeof value === 'string' && value.trim() !== '';

/** The transfer methods owners are offered: those with their details filled in (bank needs a name and an account). */
export function methodsShown(payment: Fields): PaymentMethod[] {
  return [
    ...(filled(payment.instapayAddress) ? ['instapay' as const] : []),
    ...(filled(payment.vodafoneCashNumber) ? ['vodafone' as const] : []),
    ...(filled(payment.bankName) && filled(payment.bankAccountNumber) ? ['bank' as const] : []),
  ];
}

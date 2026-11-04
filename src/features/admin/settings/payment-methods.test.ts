import { describe, expect, it } from 'vitest';
import { methodsShown } from './payment-methods';

describe('payment methods shown to owners', () => {
  it('offers a method only once its details are filled in', () => {
    expect(methodsShown({})).toEqual([]);
    expect(methodsShown({ instapayAddress: ' ', vodafoneCashNumber: '01012345678' })).toEqual(['vodafone']);
    expect(methodsShown({ bankName: 'CIB' })).toEqual([]);
    expect(methodsShown({ instapayAddress: 'a@instapay', bankName: 'CIB', bankAccountNumber: '123' })).toEqual(['instapay', 'bank']);
  });
});

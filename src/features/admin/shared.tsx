import type { AccessStatus } from '@bilhanah/contracts';
import { useSearchParams } from 'react-router';

export const ACCESS_LABELS: Record<AccessStatus, [ar: string, en: string]> = {
  TRIAL: ['تجربة مجانية', 'Free trial'],
  PAID: ['مشترك', 'Paid'],
  INACTIVE: ['مش فعّال', 'Inactive'],
  SUSPENDED: ['موقوف', 'Suspended'],
};

/** A positive page number from the address bar (invalid → 1). */
export function pageParam(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Reads and writes list state (filters, page) in the address bar, so views can be linked and survive reloads. */
export function useListParams() {
  const [params, setParams] = useSearchParams();
  const update = (changes: Record<string, string | number | null>, options: { replace?: boolean } = {}) => {
    setParams(current => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      return next;
    }, { replace: options.replace });
  };
  return [params, update] as const;
}

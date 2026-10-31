import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type BillingSummary, RESTAURANT_ERROR_CODES, type OwnerRestaurant, type StatsPeriod } from '@bilhanah/contracts';
import { isApiError } from '../../lib/api';
import { authApi, billingApi, menuApi, restaurantApi, tablesApi } from '../../lib/api/endpoints';

export const queryKeys = {
  restaurant: ['restaurant'] as const,
  menu: ['menu'] as const,
  sessions: ['auth', 'sessions'] as const,
  billing: ['billing'] as const,
  subdomain: (name: string) => ['subdomain-availability', name] as const,
  /** The live board (active orders, oldest first). */
  board: ['orders', 'board'] as const,
  orderHistory: (page: number) => ['orders', 'history', page] as const,
  orderHistoryAll: ['orders', 'history'] as const,
  order: (id: string) => ['orders', 'detail', id] as const,
  tables: ['tables'] as const,
  /** Which tables have guests right now (GET /v1/orders/floor). */
  floor: ['orders', 'floor'] as const,
  stats: (days: StatsPeriod) => ['stats', days] as const,
  kitchenAccounts: ['kitchen-accounts'] as const,
  /** The kitchen screen's restaurant (kitchen accounts only). */
  kitchenContext: ['kitchen', 'context'] as const,
};

export function useRestaurantQuery() {
  return useQuery({
    queryKey: queryKeys.restaurant,
    queryFn: restaurantApi.mine,
    retry: (count, error) => !isApiError(error, RESTAURANT_ERROR_CODES.RESTAURANT_NOT_FOUND) && count < 2,
  });
}

/** The owner's restaurant inside the owner shell, where RestaurantGate guarantees it is loaded. */
export function useRestaurant(): OwnerRestaurant {
  const { data } = useRestaurantQuery();
  if (!data) throw new Error('useRestaurant() is only available inside the owner shell.');
  return data;
}

export function useMenuQuery() {
  return useQuery({ queryKey: queryKeys.menu, queryFn: menuApi.get });
}

export function useSessionsQuery() {
  return useQuery({ queryKey: queryKeys.sessions, queryFn: authApi.sessions });
}

/** `refetchInterval`: e.g. every few seconds while an online payment is being confirmed. */
export function useBillingQuery(options: { refetchInterval?: (data: BillingSummary | undefined) => number | false } = {}) {
  const { refetchInterval } = options;
  return useQuery({
    queryKey: queryKeys.billing,
    queryFn: billingApi.summary,
    refetchInterval: refetchInterval ? query => refetchInterval(query.state.data) : undefined,
  });
}

export function useTablesQuery() {
  return useQuery({ queryKey: queryKeys.tables, queryFn: tablesApi.list });
}

/** Visits and orders over the last `days` days; the previous period stays on screen while another loads. */
export function useStatsQuery(days: StatsPeriod) {
  return useQuery({ queryKey: queryKeys.stats(days), queryFn: ({ signal }) => restaurantApi.stats(days, signal), placeholderData: keepPreviousData });
}

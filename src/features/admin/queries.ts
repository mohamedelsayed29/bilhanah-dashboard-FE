import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
import type { PaymentStatus } from '@bilhanah/contracts';
import { adminApi, type AdminRestaurantsQuery } from '../../lib/api/endpoints';

export const adminKeys = {
  all: ['admin'] as const,
  overview: ['admin', 'overview'] as const,
  payments: ['admin', 'payments'] as const,
  paymentList: (status: PaymentStatus | undefined, page: number) => ['admin', 'payments', 'list', status ?? 'ALL', page] as const,
  payment: (id: string) => ['admin', 'payments', 'detail', id] as const,
  restaurants: ['admin', 'restaurants'] as const,
  restaurantList: (params: AdminRestaurantsQuery) => ['admin', 'restaurants', 'list', params] as const,
  restaurant: (id: string) => ['admin', 'restaurants', 'detail', id] as const,
  settings: ['admin', 'settings'] as const,
  audit: ['admin', 'audit'] as const,
  auditPage: (page: number) => ['admin', 'audit', page] as const,
};

/** The overview also feeds the pending-payments badge in the navigation, so it refreshes on its own. */
export function useAdminOverview() {
  return useQuery({ queryKey: adminKeys.overview, queryFn: adminApi.overview, refetchInterval: 60_000 });
}

export function usePaymentsQuery(status: PaymentStatus | undefined, page: number) {
  return useQuery({ queryKey: adminKeys.paymentList(status, page), queryFn: () => adminApi.payments({ status, page }), placeholderData: keepPreviousData });
}

export function usePaymentQuery(id: string | null) {
  return useQuery({ queryKey: adminKeys.payment(id ?? ''), queryFn: () => adminApi.payment(id!), enabled: id !== null });
}

export function useRestaurantsQuery(params: AdminRestaurantsQuery) {
  return useQuery({
    queryKey: adminKeys.restaurantList(params),
    queryFn: ({ signal }) => adminApi.restaurants(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useAdminRestaurantQuery(id: string | null) {
  return useQuery({ queryKey: adminKeys.restaurant(id ?? ''), queryFn: () => adminApi.restaurant(id!), enabled: id !== null });
}

export function useAdminSettingsQuery() {
  return useQuery({ queryKey: adminKeys.settings, queryFn: adminApi.settings });
}

export function useAuditQuery(page: number) {
  return useQuery({ queryKey: adminKeys.auditPage(page), queryFn: () => adminApi.audit(page), placeholderData: keepPreviousData });
}

/** After a review, grant or suspension: everything that shows payments, access or the audit log. */
export function invalidateAfterChange(queryClient: QueryClient, restaurantId?: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: adminKeys.payments }),
    queryClient.invalidateQueries({ queryKey: adminKeys.overview }),
    queryClient.invalidateQueries({ queryKey: adminKeys.audit }),
    queryClient.invalidateQueries({ queryKey: restaurantId ? adminKeys.restaurant(restaurantId) : adminKeys.restaurants }),
    restaurantId && queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants', 'list'] }),
  ]);
}

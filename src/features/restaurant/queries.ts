import { useQuery } from '@tanstack/react-query';
import { RESTAURANT_ERROR_CODES, type OwnerRestaurant } from '@bilhanah/contracts';
import { isApiError } from '../../lib/api';
import { authApi, billingApi, menuApi, restaurantApi } from '../../lib/api/endpoints';

export const queryKeys = {
  restaurant: ['restaurant'] as const,
  menu: ['menu'] as const,
  sessions: ['auth', 'sessions'] as const,
  billing: ['billing'] as const,
  subdomain: (name: string) => ['subdomain-availability', name] as const,
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

export function useBillingQuery() {
  return useQuery({ queryKey: queryKeys.billing, queryFn: billingApi.summary });
}

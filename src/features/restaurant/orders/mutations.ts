import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ORDER_ERROR_CODES, type OrderStatus, type OwnerOrder, type OwnerRestaurant } from '@bilhanah/contracts';
import { useToast } from '../../../components/Toast';
import { isApiError } from '../../../lib/api';
import { ordersApi, restaurantApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { useLanguage } from '../../../lib/language';
import { queryKeys } from '../queries';
import { isActiveStatus, upsertOrder, withStatus } from './board';
import { actionDone } from './labels';

/** Orders never move back to PLACED. */
export type NextStatus = Exclude<OrderStatus, 'PLACED'>;
type Change = { order: OwnerOrder; status: NextStatus; reason?: string | null };

/**
 * Moves an order on the board right away and sends the change; rolls the card back when the
 * API refuses. 409 INVALID_STATUS_CHANGE means another device got there first: refetch.
 */
export function useOrderStatus({ announce }: { announce?: (message: string) => void } = {}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { text, number } = useLanguage();
  return useMutation({
    mutationFn: ({ order, status, reason }: Change) => ordersApi.updateStatus(order.id, { status, reason: reason ?? null }),
    onMutate: async ({ order, status, reason }: Change) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.board });
      queryClient.setQueryData<OwnerOrder[]>(queryKeys.board, current => (current ? withStatus(current, order.id, status, reason ?? null) : current));
    },
    onError: (error, { order }) => {
      // Only this card goes back; other live changes on the board stay.
      queryClient.setQueryData<OwnerOrder[]>(queryKeys.board, current => (current ? upsertOrder(current, order, true) : current));
      if (isApiError(error, ORDER_ERROR_CODES.INVALID_STATUS_CHANGE) || isApiError(error, ORDER_ERROR_CODES.ORDER_NOT_FOUND)) {
        toast.error(text('الطلب ده اتحدّث من جهاز تاني، وحدّثنا اللوحة.', 'This order was updated on another device; the board has been refreshed.'));
        void queryClient.invalidateQueries({ queryKey: queryKeys.board });
      } else {
        toast.error(errorMessage(error, text));
      }
    },
    onSuccess: (saved, { status }) => {
      queryClient.setQueryData<OwnerOrder[]>(queryKeys.board, current => (current ? upsertOrder(current, saved) : current));
      queryClient.setQueryData(queryKeys.order(saved.id), saved);
      if (!isActiveStatus(saved.status)) void queryClient.invalidateQueries({ queryKey: queryKeys.orderHistoryAll });
      // The card moving is the visible confirmation; screen readers hear it (no toast pile-up on a busy board).
      const message = actionDone(status, saved.number, text, number);
      if (announce) announce(message);
      else toast.success(message);
    },
  });
}

/** Pause or resume taking orders (diners see "not taking orders right now"). */
export function useOrdersPause() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { text } = useLanguage();
  return useMutation({
    mutationFn: (paused: boolean) => restaurantApi.update({ ordersPaused: paused }),
    onSuccess: (restaurant: OwnerRestaurant) => {
      queryClient.setQueryData(queryKeys.restaurant, restaurant);
      toast.success(restaurant.ordering.paused
        ? text('وقّفنا استقبال الطلبات مؤقتًا', 'New orders are paused')
        : text('رجعنا نستقبل طلبات', 'Taking orders again'));
    },
    onError: error => toast.error(errorMessage(error, text)),
  });
}

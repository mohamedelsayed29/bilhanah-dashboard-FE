import type {
  AccessStatus,
  AdminEntitlement,
  AdminOverview,
  AdminPayment,
  AdminRestaurantDetail,
  AdminRestaurantRow,
  AdminSettings,
  AdminStandOrder,
  AuditEntry,
  AuditScope,
  AuthUser,
  grantEntitlementSchema,
  OwnerPayment,
  Paginated,
  PaymentStatus,
  PlanCode,
  PlatformStats,
  ShopSettings,
  StandOrderStatus,
  StatsPeriod,
  updatePaymentSettingsSchema,
  updateStandOrderSchema,
  updateTrialSettingsSchema,
} from '@bilhanah/contracts';
import type { z } from 'zod';
import { apiClient } from './index';

const { request } = apiClient;

/** The administrators' session: sign-in with the authenticator code, sign-out, the signed-in account. */
export const authApi = {
  adminLogin: apiClient.adminLogin,
  logout: apiClient.logout,
  me: () => request<AuthUser>('/v1/auth/me'),
};

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
}
const id = (value: string) => encodeURIComponent(value);


export type AdminRestaurantsQuery = { query?: string; access?: AccessStatus; page?: number; pageSize?: number };
/** `open`: not yet delivered or cancelled. */
export type StandOrderFilter = StandOrderStatus | 'open';
export type AdminStandOrdersQuery = { status?: StandOrderFilter; query?: string; page?: number; pageSize?: number };

/** Platform administration (administrators only). */
export const adminApi = {
  overview: () => request<AdminOverview>('/v1/admin/overview'),
  restaurants: (params: AdminRestaurantsQuery, signal?: AbortSignal) =>
    request<Paginated<AdminRestaurantRow>>(`/v1/admin/restaurants${query(params)}`, { signal }),
  restaurant: (restaurantId: string) => request<AdminRestaurantDetail>(`/v1/admin/restaurants/${id(restaurantId)}`),
  suspend: (restaurantId: string, reason: string) => request<void>(`/v1/admin/restaurants/${id(restaurantId)}/suspend`, { method: 'POST', body: { reason } }),
  unsuspend: (restaurantId: string) => request<void>(`/v1/admin/restaurants/${id(restaurantId)}/unsuspend`, { method: 'POST' }),
  grant: (restaurantId: string, body: z.output<typeof grantEntitlementSchema>) =>
    request<AdminEntitlement>(`/v1/admin/restaurants/${id(restaurantId)}/entitlements`, { method: 'POST', body }),
  payments: (params: { status?: PaymentStatus; page?: number; pageSize?: number }) =>
    request<Paginated<AdminPayment>>(`/v1/admin/payments${query(params)}`),
  payment: (paymentId: string) => request<AdminPayment>(`/v1/admin/payments/${id(paymentId)}`),
  proofPath: (paymentId: string) => `/v1/admin/payments/${id(paymentId)}/proof`,
  approve: (paymentId: string) => request<OwnerPayment>(`/v1/admin/payments/${id(paymentId)}/approve`, { method: 'POST' }),
  reject: (paymentId: string, reason: string) => request<OwnerPayment>(`/v1/admin/payments/${id(paymentId)}/reject`, { method: 'POST', body: { reason } }),
  settings: () => request<AdminSettings>('/v1/admin/settings'),
  updatePaymentSettings: (body: z.output<typeof updatePaymentSettingsSchema>) => request<AdminSettings>('/v1/admin/settings/payment', { method: 'PUT', body }),
  updateTrialSettings: (body: z.output<typeof updateTrialSettingsSchema>) => request<AdminSettings>('/v1/admin/settings/trial', { method: 'PUT', body }),
  updatePlanPrice: (code: PlanCode, priceMonthlyPiastres: number) =>
    request<AdminSettings>(`/v1/admin/plans/${code}`, { method: 'PUT', body: { priceMonthlyPiastres } }),
  /** `scope`: the admin console's own changes, or restaurants'; both when omitted. */
  audit: (page: number, scope?: AuditScope) => request<Paginated<AuditEntry>>(`/v1/admin/audit${query({ page, scope })}`),
  /** Daily platform figures in Cairo time. */
  stats: (days: StatsPeriod, signal?: AbortSignal) => request<PlatformStats>(`/v1/admin/stats?days=${days}`, { signal }),
  shopSettings: () => request<ShopSettings>('/v1/admin/settings/shop'),
  updateShopSettings: (body: ShopSettings) => request<ShopSettings>('/v1/admin/settings/shop', { method: 'PUT', body }),
  /** The stand-shop fulfilment queue, newest first. */
  standOrders: (params: AdminStandOrdersQuery, signal?: AbortSignal) =>
    request<Paginated<AdminStandOrder>>(`/v1/admin/stand-orders${query(params)}`, { signal }),
  standOrder: (orderId: string) => request<AdminStandOrder>(`/v1/admin/stand-orders/${id(orderId)}`),
  /** A note is required to cancel; allowed moves are in STAND_ORDER_TRANSITIONS. */
  updateStandOrderStatus: (orderId: string, body: { status: StandOrderStatus; note?: string }) =>
    request<AdminStandOrder>(`/v1/admin/stand-orders/${id(orderId)}/status`, { method: 'PATCH', body }),
  /** The internal note, or cash collected (paymentStatus PAID). */
  updateStandOrder: (orderId: string, body: z.input<typeof updateStandOrderSchema>) =>
    request<AdminStandOrder>(`/v1/admin/stand-orders/${id(orderId)}`, { method: 'PATCH', body }),
  /** Path of a line's uploaded logo (fetch it with `apiClient.requestBlob`). */
  standLogoPath: (orderId: string, lineId: string) => `/v1/admin/stand-orders/${id(orderId)}/lines/${id(lineId)}/logo`,
};

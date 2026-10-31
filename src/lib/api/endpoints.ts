import type {
  AdminStandOrder,
  OnlineCheckout,
  PlatformStats,
  RestaurantStats,
  ShopSettings,
  StandOrderStatus,
  StatsPeriod,
  startOnlinePaymentSchema,
  updateStandOrderSchema,
  AdminEntitlement,
  AdminOverview,
  AdminPayment,
  AdminRestaurantDetail,
  AdminRestaurantRow,
  AdminSettings,
  AuditEntry,
  BillingSummary,
  createKitchenAccountSchema,
  KitchenAccount,
  KitchenContext,
  updateKitchenAccountSchema,
  bulkCreateTablesSchema,
  createTableSchema,
  OwnerOrder,
  RestaurantTable,
  TableOccupancy,
  updateOrderStatusSchema,
  updateTableSchema,
  grantEntitlementSchema,
  OwnerPayment,
  Paginated,
  PaymentStatus,
  PlanCode,
  submitPaymentSchema,
  updatePaymentSettingsSchema,
  updateTrialSettingsSchema,
  AccessStatus,
  AuthSession,
  AuthUser,
  changePasswordSchema,
  updateProfileSchema,
  createCategorySchema,
  createItemSchema,
  createRestaurantSchema,
  ImageSet,
  MediaKind,
  OwnerMenu,
  OwnerMenuCategory,
  OwnerMenuItem,
  OwnerRestaurant,
  PublicMenuResponse,
  registerOwnerSchema,
  SubdomainAvailability,
  updateCategorySchema,
  updateItemSchema,
  updateRestaurantSchema,
  VerifyEmailResponse,
} from '@bilhanah/contracts';
import type { z } from 'zod';
import { apiClient } from './index';
import type { UploadOptions } from './client';

const { request } = apiClient;
const post = (path: string, body?: unknown, auth = true) => request<void>(path, { method: 'POST', body, auth });

/** Every API route the dashboard uses, typed with the shared contracts. */
export const authApi = {
  register: (body: z.output<typeof registerOwnerSchema>) => post('/v1/auth/register', body, false),
  resendVerification: (email: string) => post('/v1/auth/resend-verification', { email }, false),
  verifyEmail: (token: string) => request<VerifyEmailResponse>('/v1/auth/verify-email', { method: 'POST', body: { token }, auth: false }),
  login: apiClient.login,
  adminLogin: apiClient.adminLogin,
  logout: apiClient.logout,
  forgotPassword: (email: string) => post('/v1/auth/forgot-password', { email }, false),
  resetPassword: (token: string, password: string) => post('/v1/auth/reset-password', { token, password }, false),
  me: () => request<AuthUser>('/v1/auth/me'),
  updateProfile: (body: z.output<typeof updateProfileSchema>) => request<AuthUser>('/v1/auth/me', { method: 'PATCH', body }),
  sessions: () => request<AuthSession[]>('/v1/auth/sessions'),
  revokeSession: (id: string) => request<void>(`/v1/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  changePassword: (body: z.output<typeof changePasswordSchema>) => post('/v1/auth/change-password', body),
};

export const restaurantApi = {
  subdomainAvailability: (name: string, signal?: AbortSignal) =>
    request<SubdomainAvailability>(`/v1/restaurants/subdomain-availability?name=${encodeURIComponent(name)}`, { signal }),
  create: (body: z.output<typeof createRestaurantSchema>) => request<OwnerRestaurant>('/v1/restaurants', { method: 'POST', body }),
  mine: () => request<OwnerRestaurant>('/v1/restaurants/mine'),
  update: (body: z.output<typeof updateRestaurantSchema>) => request<OwnerRestaurant>('/v1/restaurants/mine', { method: 'PATCH', body }),
  publicMenu: (subdomain: string) => request<PublicMenuResponse>(`/v1/public/restaurants/${encodeURIComponent(subdomain)}/menu`, { auth: false }),
  /** Visits and orders per day, in the restaurant's time zone. */
  stats: (days: StatsPeriod, signal?: AbortSignal) => request<RestaurantStats>(`/v1/restaurants/mine/stats?days=${days}`, { signal }),
};

export const menuApi = {
  get: () => request<OwnerMenu>('/v1/menu'),
  createCategory: (body: z.output<typeof createCategorySchema>) => request<OwnerMenuCategory>('/v1/menu/categories', { method: 'POST', body }),
  updateCategory: (id: string, body: z.output<typeof updateCategorySchema>) => request<void>(`/v1/menu/categories/${id}`, { method: 'PATCH', body }),
  deleteCategory: (id: string) => request<void>(`/v1/menu/categories/${id}`, { method: 'DELETE' }),
  reorderCategories: (ids: string[]) => request<void>('/v1/menu/categories/order', { method: 'PUT', body: { ids } }),
  createItem: (body: z.output<typeof createItemSchema>) => request<OwnerMenuItem>('/v1/menu/items', { method: 'POST', body }),
  updateItem: (id: string, body: z.output<typeof updateItemSchema>) => request<OwnerMenuItem>(`/v1/menu/items/${id}`, { method: 'PATCH', body }),
  deleteItem: (id: string) => request<void>(`/v1/menu/items/${id}`, { method: 'DELETE' }),
  reorderItems: (categoryId: string, ids: string[]) => request<void>(`/v1/menu/categories/${categoryId}/items/order`, { method: 'PUT', body: { ids } }),
};

export const mediaApi = {
  upload: (file: File, kind: MediaKind, options?: UploadOptions) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.uploadFile<ImageSet>(`/v1/media?kind=${kind}`, form, options);
  },
};

/** `?a=1&b=x`, skipping empty values. */
function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
}
const id = (value: string) => encodeURIComponent(value);

/** The owner's subscription and manual-transfer payments. */
export const billingApi = {
  summary: () => request<BillingSummary>('/v1/billing'),
  submit: (body: z.output<typeof submitPaymentSchema>) => request<OwnerPayment>('/v1/billing/payments', { method: 'POST', body }),
  /** Starts a Paymob checkout (cancelling earlier unfinished ones); send the browser to `checkoutUrl`. */
  startOnline: (body: z.output<typeof startOnlinePaymentSchema>) => request<OnlineCheckout>('/v1/billing/online', { method: 'POST', body }),
  withdraw: (paymentId: string) => request<void>(`/v1/billing/payments/${id(paymentId)}`, { method: 'DELETE' }),
  /** Path of the receipt image (fetch it with `apiClient.requestBlob`). */
  proofPath: (paymentId: string) => `/v1/billing/payments/${id(paymentId)}/proof`,
};

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
  audit: (page: number) => request<Paginated<AuditEntry>>(`/v1/admin/audit${query({ page })}`),
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

/** The live order board, order history and status changes. */
export const ordersApi = {
  /** active: the board, oldest first. history: closed orders, newest first. */
  list: (params: { view: 'active' | 'history'; page?: number; pageSize?: number }) => request<Paginated<OwnerOrder>>(`/v1/orders${query(params)}`),
  get: (orderId: string) => request<OwnerOrder>(`/v1/orders/${id(orderId)}`),
  updateStatus: (orderId: string, body: z.output<typeof updateOrderStatusSchema>) =>
    request<OwnerOrder>(`/v1/orders/${id(orderId)}/status`, { method: 'PATCH', body }),
  setPaid: (orderId: string, paid: boolean) => request<OwnerOrder>(`/v1/orders/${id(orderId)}/payment`, { method: 'PATCH', body: { paid } }),
  /** Active tables and whether guests (an unpaid order) are at each. */
  floor: () => request<TableOccupancy[]>('/v1/orders/floor'),
  /** Marks every open order on the table paid; returns the whole floor. */
  settleTable: (tableId: string) => request<TableOccupancy[]>(`/v1/orders/tables/${id(tableId)}/settle`, { method: 'POST' }),
};

/** Tables and the QR codes printed on them. */
export const tablesApi = {
  list: () => request<RestaurantTable[]>('/v1/tables'),
  create: (body: z.input<typeof createTableSchema>) => request<RestaurantTable>('/v1/tables', { method: 'POST', body }),
  /** Returns every table after creating the range. */
  createRange: (body: z.input<typeof bulkCreateTablesSchema>) => request<RestaurantTable[]>('/v1/tables/range', { method: 'POST', body }),
  update: (tableId: string, body: z.output<typeof updateTableSchema>) => request<RestaurantTable>(`/v1/tables/${id(tableId)}`, { method: 'PATCH', body }),
  remove: (tableId: string) => request<void>(`/v1/tables/${id(tableId)}`, { method: 'DELETE' }),
  /** A new code: printed QR codes of this table stop working. */
  regenerateCode: (tableId: string) => request<RestaurantTable>(`/v1/tables/${id(tableId)}/code`, { method: 'POST' }),
};

/** The owner's kitchen accounts (the kitchen screens' sign-ins). */
export const kitchenAccountsApi = {
  list: () => request<KitchenAccount[]>('/v1/kitchen-accounts'),
  create: (body: z.output<typeof createKitchenAccountSchema>) => request<KitchenAccount>('/v1/kitchen-accounts', { method: 'POST', body }),
  update: (accountId: string, body: z.output<typeof updateKitchenAccountSchema>) =>
    request<KitchenAccount>(`/v1/kitchen-accounts/${id(accountId)}`, { method: 'PATCH', body }),
  /** Signs the account's screens out. */
  setPassword: (accountId: string, password: string) => post(`/v1/kitchen-accounts/${id(accountId)}/password`, { password }),
  remove: (accountId: string) => request<void>(`/v1/kitchen-accounts/${id(accountId)}`, { method: 'DELETE' }),
};

/** What the kitchen screen reads about its restaurant. */
export const kitchenApi = {
  context: () => request<KitchenContext>('/v1/kitchen/context'),
};

import type {
  AuthSession,
  AuthUser,
  changePasswordSchema,
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
  logout: apiClient.logout,
  forgotPassword: (email: string) => post('/v1/auth/forgot-password', { email }, false),
  resetPassword: (token: string, password: string) => post('/v1/auth/reset-password', { token, password }, false),
  me: () => request<AuthUser>('/v1/auth/me'),
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

/** NestJS API origin. */
export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

/** Shown in the onboarding preview as `{subdomain}.{MENU_DOMAIN}`; the real link comes from the API (`publicUrl`). */
export const MENU_DOMAIN = import.meta.env.VITE_MENU_DOMAIN || 'bilhanah.com';

/** Marketing site, linked from the sign-in pages. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:5180' : 'https://bilhanah.com')).replace(/\/$/, '');

/**
 * Which app this bundle is: the restaurants' dashboard, or the platform admin console (VITE_APP=admin),
 * served on its own origin with its own session, so the two never share a sign-in.
 */
export const APP: 'restaurant' | 'admin' = import.meta.env.VITE_APP === 'admin' ? 'admin' : 'restaurant';

/** The session routes of this app: administrators renew and end theirs on their own routes and cookie. */
export const SESSION_ROUTES = APP === 'admin'
  ? { refresh: '/v1/auth/admin/refresh', logout: '/v1/auth/admin/logout' }
  : { refresh: '/v1/auth/refresh', logout: '/v1/auth/logout' };

/** The admin console, linked from nowhere in the restaurant app (it is for Bilhanah's own team). */
export const ADMIN_APP_URL = (import.meta.env.VITE_ADMIN_URL || 'http://127.0.0.1:5175').replace(/\/$/, '');

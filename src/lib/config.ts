/** NestJS API origin. */
export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

/** Marketing site, linked from the sign-in page. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:5180' : 'https://bilhanah.com')).replace(/\/$/, '');

/**
 * The admin console has its own origin and session (the admin refresh cookie), so it never shares a
 * sign-in with the restaurants' dashboard (bilhanah-client-FE/dashboard).
 */
export const SESSION_ROUTES = { refresh: '/v1/auth/admin/refresh', logout: '/v1/auth/admin/logout' };

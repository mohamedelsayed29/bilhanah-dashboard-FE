/** NestJS API origin. */
export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

/** Shown in the onboarding preview as `{subdomain}.{MENU_DOMAIN}`; the real link comes from the API (`publicUrl`). */
export const MENU_DOMAIN = import.meta.env.VITE_MENU_DOMAIN || 'bilhanah.com';

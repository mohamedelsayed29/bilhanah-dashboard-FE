/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** NestJS API origin, e.g. http://127.0.0.1:3000. */
  readonly VITE_API_URL?: string;
  /** Domain shown in the onboarding address preview, e.g. bilhanah.com. */
  readonly VITE_MENU_DOMAIN?: string;
  /** Marketing site origin, e.g. https://bilhanah.com. */
  readonly VITE_SITE_URL?: string;
  /** "admin" builds the platform admin console (its own origin and session); anything else the restaurants' dashboard. */
  readonly VITE_APP?: string;
  /** Where the admin console lives, e.g. https://admin.bilhanah.com. */
  readonly VITE_ADMIN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

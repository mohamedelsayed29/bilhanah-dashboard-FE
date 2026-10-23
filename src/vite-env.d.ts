/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** NestJS API origin, e.g. http://127.0.0.1:3000. */
  readonly VITE_API_URL?: string;
  /** Domain shown in the onboarding address preview, e.g. bilhanah.com. */
  readonly VITE_MENU_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

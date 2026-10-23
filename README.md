# Restaurant Dashboard

The restaurant owner's dashboard for Bilhanah (بالهنا): sign-up, onboarding, the menu editor, QR codes and settings. It is Arabic-first (RTL) with English, and works on phones.

Stack: React 19, TypeScript, Vite, React Router, TanStack Query, react-hook-form with the zod schemas from `@bilhanah/contracts`, and dnd-kit for drag-and-drop. The brand tokens, fonts and the inline `text('عربي', 'English')` language provider are the same as the marketing site (`apps/web`).

## Running locally

The API must be running (see `apps/api/README.md`); email links are caught by Mailpit at http://127.0.0.1:8025.

```bash
cp apps/dashboard/.env.example apps/dashboard/.env   # optional; the defaults suit local development
npm run dev -w @bilhanah/dashboard                   # http://127.0.0.1:5174
```

The dev server is pinned to `127.0.0.1:5174` (`strictPort`): it is the origin the API allows for credentialed CORS (`CORS_ORIGINS`) and the `DASHBOARD_URL` in email links. Use `127.0.0.1`, not `localhost`; they are different origins.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://127.0.0.1:3000` | API origin |
| `VITE_MENU_DOMAIN` | `bilhanah.com` | Domain in the onboarding address preview. The real public link always comes from the API (`publicUrl`) |

| Command (`-w @bilhanah/dashboard`) | Purpose |
| --- | --- |
| `npm run dev` | Dev server on 127.0.0.1:5174 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit tests (Vitest): session refresh coordination, price conversion, menu cache updates |
| `npm run test:e2e` | Playwright against the running API, worker and Mailpit (see below) |

### End-to-end tests

`tests/owner-journey.spec.ts` registers a new owner (confirmed through the Mailpit API), creates a restaurant, builds a menu with a photo, sizes, sold-out and reordering, checks `GET /v1/public/restaurants/:subdomain/menu`, saves branding and opening hours, changes the password, downloads the QR code, and checks Arabic, English and 390 px layouts with axe. `tests/public-pages.spec.ts` covers the signed-out pages. Every run uses a new email and subdomain because the development database is shared; the API allows 10 registrations per IP per hour.

Screenshots of the main screens are written to `test-results/screens/`. Locally the tests use the installed Chrome (`channel: 'chrome'`); in CI they use Playwright's Chromium. The port can be changed with `DASHBOARD_E2E_PORT` (the API must allow that origin), the API and Mailpit with `E2E_API_URL` and `E2E_MAILPIT_URL`.

## Structure

```
src/
  main.tsx                    Entry: fonts, styles, providers, router
  app/
    router.tsx                Routes; menu, QR, settings and onboarding load on demand
    router/guards.tsx         RequireAuth, RequireGuest, RestaurantGate (no restaurant → onboarding), OnboardingGate
    providers/                Query client, language, toasts, session restore on startup
  layouts/
    AuthLayout.tsx            Brand photo panel + form (sign-in, registration, email links, onboarding)
    OwnerLayout.tsx           Sidebar on desktop; top bar and bottom tab bar on phones
  lib/
    api/client.ts             fetch wrapper: JSON, credentials, bearer token, ApiError, refresh on 401
    api/single-flight.ts      One refresh at a time per tab and across tabs (navigator.locks)
    api/endpoints.ts          Typed calls for every route the dashboard uses
    api/error-messages.ts     Error codes → Arabic/English messages
    session/                  In-memory session store (access token never touches storage)
    forms.ts                  zod resolver with translatable validation messages
    format.ts                 EGP ⇄ piastres, dates, Arabic-Indic digits
    language.tsx              Language provider (shared approach with apps/web)
  components/                 Button, Field, Dialog, ConfirmDialog, Toast, Switch, ImageUpload, ErrorBoundary…
  features/
    auth/                     Login, register, check email, verify email, forgot/reset password, logout
    onboarding/               Restaurant details with a live subdomain check
    restaurant/overview/      Link, trial/plan status, menu stats, setup checklist
    restaurant/menu/          Menu editor (categories, items, photos, sizes, sold out, drag and keyboard reordering)
    restaurant/qr-codes/      QR code with PNG (1024 px) and SVG downloads
    restaurant/settings/      Profile and social links, branding with live preview, opening hours, password and sessions
  styles/                     Tokens (shared with apps/web), layouts, pages
tests/                        Playwright end-to-end tests
```

`features/admin`, `restaurant/orders`, `restaurant/tables` and `restaurant/subscription` are later phases.

## Sessions

- The access token lives in memory only. On startup the dashboard calls `POST /v1/auth/refresh`; the HttpOnly refresh cookie (scoped to `/v1/auth` on the API) restores the session.
- Every request is sent with `credentials: 'include'`. A 401 triggers one shared refresh and a single retry. Refresh tokens rotate and reuse revokes the session, so refreshes never overlap: callers in a tab share the in-flight refresh, and tabs take turns through `navigator.locks` (falling back to an in-tab queue). Sign-in and sign-out hold the same lock.
- Sign-in and sign-out are broadcast to other tabs (`BroadcastChannel`).
- Email links carry their token in the fragment (`/verify-email#token=…`, `/reset-password#token=…`); it is read once and removed from the address bar.

Route guards only shape navigation; the API enforces authorization.

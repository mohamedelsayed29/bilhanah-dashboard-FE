# Bilhanah Dashboard (admin console)

The platform admin console for Bilhanah's own team (بالهنا): restaurants and their access, subscription payments and their review, the stand shop's orders and settings, plan prices, the free trial, platform reports and the audit log. It is Arabic-first (RTL) with English.

It is for administrators only. Restaurants (owners, staff, kitchen screens) use the restaurants' dashboard in the `dashboard/` folder of [bilhanah-client-FE](https://github.com/mohamedelsayed29/bilhanah-client-FE), on its own origin and session. Part of Bilhanah, three repositories cloned side by side: [bilhanah-BE](https://github.com/mohamedelsayed29/bilhanah-BE) (API, shared packages, infrastructure), bilhanah-client-FE (website and the restaurants' dashboard) and this one. To run everything together, use `npm run dev` in bilhanah-BE; it starts this app too.

`packages/contracts` is a copy of the API's request/response schemas, owned by bilhanah-BE. Do not edit it here: change it in bilhanah-BE and run `npm run contracts:sync` there (see `packages/README.md`).

## Running locally

```bash
cp .env.example .env   # optional; the defaults suit local development
npm run dev            # http://127.0.0.1:5175
```

The dev server is pinned to `127.0.0.1:5175` (`strictPort`): it is the origin the API allows for the console (`ADMIN_ORIGINS`). Use `127.0.0.1`, not `localhost`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on 127.0.0.1:5175 |
| `npm run build` | Type-check and build to `dist/` (needs `VITE_API_URL`) |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Playwright: `tests/phase6-mocked.spec.ts` answers the API itself; `tests/billing-admin.spec.ts` needs the whole stack, including the restaurants' dashboard on 127.0.0.1:5174 |

## What it does

Administrators are users with the `ADMIN` role. Create one with the API's CLI (`npm run admin:create -- --email … --name …` in bilhanah-BE) and add the printed key to an authenticator app.

- **Sign in** at `/admin/login` with email, password and the 6-digit code (`POST /v1/auth/admin/login`). The session is restored on reload (see Sessions). Wrong passwords and wrong codes get the same message; `MFA_NOT_SET_UP` tells the administrator to ask an operator to run `npm run admin:reset-mfa`. The restaurants' sign-in rejects administrators (the API does).
- **Routing**: every other path goes to `/admin`, signed-out visitors of `/admin/*` to `/admin/login?next=…`. Signing out returns to `/admin/login`.

| Route | Page |
| --- | --- |
| `/admin` | Overview: restaurants by access status, monthly recurring revenue, payments waiting for review, periods ending within 7 days, new restaurants |
| `/admin/payments?status=&page=&view=` | Review queue (pending, oldest first) and other statuses; `view=<id>` opens a payment with its receipt (zoom, full size) to approve or reject with a reason |
| `/admin/restaurants?query=&access=&page=` | Search by name, subdomain, owner email or phone, filter by access |
| `/admin/restaurants/:id` | Details, access, menu counts, periods timeline, payments; suspend / unsuspend, grant a paid period |
| `/admin/settings` (`/shop`, `/trial`, `/plans`) | Payment details shown to owners (an empty method is hidden), the stand shop, trial defaults for new restaurants, plan prices in EGP |
| `/admin/stand-orders`, `/admin/stats` | The stand-shop fulfilment queue; daily platform figures |
| `/admin/audit?page=&scope=` | Every change (the console's own or restaurants'), newest first, in readable words |

The pending-payment count in the navigation refreshes every minute; reviews, grants and suspensions refresh the queue, overview, restaurant and audit log.

## Sessions

- The console has its own session: `POST /v1/auth/admin/login` (password and authenticator code), renewed with `POST /v1/auth/admin/refresh` and ended with `POST /v1/auth/admin/logout`, on a refresh cookie scoped to `/v1/auth/admin`. A restaurant session never opens it, and an admin session never opens the restaurants' dashboard. The API ends it 12 hours after sign-in.
- The access token lives in memory only; a 401 triggers one shared refresh and a single retry, with tabs taking turns through `navigator.locks`. Sign-in and sign-out are broadcast to other tabs.

Route guards only shape navigation; the API enforces authorization.

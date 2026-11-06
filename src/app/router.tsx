import type React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { RouteErrorPage } from '../components/ErrorBoundary';
import { AuthLayout } from '../layouts/AuthLayout';
import { LogoutPage } from '../features/auth/LogoutPage';
import { Splash } from './providers/SessionBootstrap';
import { RequireAdmin, RequireGuest } from './router/guards';
import type { RouteObject } from 'react-router';

const page = <T,>(load: () => Promise<T>, pick: (module: T) => React.ComponentType) => async () => ({ Component: pick(await load()) });

/** The platform admin console: administrators only, on its own origin and session. */
const adminRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/admin" replace /> },
  { path: 'login', element: <Navigate to="/admin/login" replace /> },
  { element: <AuthLayout />, children: [{ path: 'logout', element: <LogoutPage /> }] },
      // Platform administrators (password + authenticator code); the console loads on demand.
      {
        path: 'admin/login',
        element: <AuthLayout />,
        children: [{ element: <RequireGuest />, children: [{ index: true, lazy: page(() => import('../features/admin/AdminLoginPage'), module => module.AdminLoginPage) }] }],
      },
      {
        path: 'admin',
        element: <RequireAdmin />,
        children: [{
          lazy: page(() => import('../layouts/AdminLayout'), module => module.AdminLayout),
          children: [
            { index: true, lazy: page(() => import('../features/admin/overview/AdminOverviewPage'), module => module.AdminOverviewPage) },
            { path: 'payments', lazy: page(() => import('../features/admin/payments/AdminPaymentsPage'), module => module.AdminPaymentsPage) },
            { path: 'stand-orders', lazy: page(() => import('../features/admin/stand-orders/AdminStandOrdersPage'), module => module.AdminStandOrdersPage) },
            { path: 'stand-orders/:orderId', lazy: page(() => import('../features/admin/stand-orders/AdminStandOrderPage'), module => module.AdminStandOrderPage) },
            { path: 'stats', lazy: page(() => import('../features/admin/reports/AdminStatsPage'), module => module.AdminStatsPage) },
            { path: 'restaurants', lazy: page(() => import('../features/admin/restaurants/AdminRestaurantsPage'), module => module.AdminRestaurantsPage) },
            { path: 'restaurants/:restaurantId', lazy: page(() => import('../features/admin/restaurants/AdminRestaurantPage'), module => module.AdminRestaurantPage) },
            {
              path: 'settings',
              lazy: page(() => import('../features/admin/settings/AdminSettingsLayout'), module => module.AdminSettingsLayout),
              children: [
                { index: true, lazy: page(() => import('../features/admin/settings/AdminSettingsPage'), module => module.PaymentSettingsPage) },
                { path: 'shop', lazy: page(() => import('../features/admin/settings/ShopSettings'), module => module.ShopSettingsPage) },
                { path: 'trial', lazy: page(() => import('../features/admin/settings/AdminSettingsPage'), module => module.TrialSettingsPage) },
                { path: 'plans', lazy: page(() => import('../features/admin/settings/AdminSettingsPage'), module => module.PlanPricesPage) },
              ],
            },
            { path: 'support', lazy: page(() => import('../features/admin/support/AdminSupportPage'), module => module.AdminSupportPage) },
            { path: 'support/faq', lazy: page(() => import('../features/admin/support/AdminFaqPage'), module => module.AdminFaqPage) },
            { path: 'support/:ticketId', lazy: page(() => import('../features/admin/support/AdminTicketPage'), module => module.AdminTicketPage) },
            { path: 'audit', lazy: page(() => import('../features/admin/audit/AdminAuditPage'), module => module.AdminAuditPage) },
          ],
        }],
      },
];

/** Bilhanah's admin console. The restaurants' dashboard is a separate app (bilhanah-client-FE/dashboard). Pages load on demand. */
export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    // Shown while a lazily loaded page opened directly (e.g. /menu) is still loading.
    hydrateFallbackElement: <Splash />,
    children: [
      ...adminRoutes,
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
]);

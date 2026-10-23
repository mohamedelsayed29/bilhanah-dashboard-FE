import type React from 'react';
import { createBrowserRouter } from 'react-router';
import { RouteErrorPage } from '../components/ErrorBoundary';
import { AuthLayout } from '../layouts/AuthLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { CheckEmailPage } from '../features/auth/CheckEmailPage';
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { LogoutPage } from '../features/auth/LogoutPage';
import { OverviewPage } from '../features/restaurant/overview/OverviewPage';
import { NotFoundPage } from './NotFoundPage';
import { Splash } from './providers/SessionBootstrap';
import { OnboardingGate, RequireAdmin, RequireAuth, RequireGuest, RestaurantGate } from './router/guards';

const page = <T,>(load: () => Promise<T>, pick: (module: T) => React.ComponentType) => async () => ({ Component: pick(await load()) });

/** Pages beyond the overview load on demand (the menu editor brings drag and drop, the QR page the QR encoder). */
export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    // Shown while a lazily loaded page opened directly (e.g. /menu) is still loading.
    hydrateFallbackElement: <Splash />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            element: <RequireGuest />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'register', element: <RegisterPage /> },
              { path: 'check-email', element: <CheckEmailPage /> },
              { path: 'forgot-password', element: <ForgotPasswordPage /> },
            ],
          },
          // Email links work whether or not this browser is signed in.
          { path: 'verify-email', element: <VerifyEmailPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
          { path: 'logout', element: <LogoutPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <OnboardingGate />,
            children: [{ element: <AuthLayout wide />, children: [{ path: 'onboarding', lazy: async () => ({ Component: (await import('../features/onboarding/OnboardingPage')).OnboardingPage }) }] }],
          },
          {
            element: <RestaurantGate />,
            children: [
              { index: true, element: <OverviewPage /> },
              { path: 'menu', lazy: async () => ({ Component: (await import('../features/restaurant/menu/MenuPage')).MenuPage }) },
              { path: 'qr-codes', lazy: async () => ({ Component: (await import('../features/restaurant/qr-codes/QrCodesPage')).QrCodesPage }) },
              { path: 'orders', lazy: page(() => import('../features/restaurant/orders/OrdersBoardPage'), module => module.OrdersBoardPage) },
              { path: 'orders/history', lazy: page(() => import('../features/restaurant/orders/OrderHistoryPage'), module => module.OrderHistoryPage) },
              { path: 'tables', lazy: page(() => import('../features/restaurant/tables/TablesPage'), module => module.TablesPage) },
              { path: 'tables/print', lazy: page(() => import('../features/restaurant/tables/TablesPrintPage'), module => module.TablesPrintPage) },
              { path: 'insights', lazy: page(() => import('../features/restaurant/insights/InsightsPage'), module => module.InsightsPage) },
              { path: 'subscription', lazy: page(() => import('../features/restaurant/subscription/SubscriptionPage'), module => module.SubscriptionPage) },
              {
                path: 'settings',
                lazy: async () => ({ Component: (await import('../features/restaurant/settings/SettingsLayout')).SettingsLayout }),
                children: [
                  { index: true, lazy: async () => ({ Component: (await import('../features/restaurant/settings/ProfileSettings')).ProfileSettings }) },
                  { path: 'branding', lazy: async () => ({ Component: (await import('../features/restaurant/settings/BrandingSettings')).BrandingSettings }) },
                  { path: 'ordering', lazy: page(() => import('../features/restaurant/settings/OrderingSettings'), module => module.OrderingSettings) },
                  { path: 'hours', lazy: async () => ({ Component: (await import('../features/restaurant/settings/OpeningHoursSettings')).OpeningHoursSettings }) },
                  { path: 'account', lazy: async () => ({ Component: (await import('../features/restaurant/settings/AccountSettings')).AccountSettings }) },
                ],
              },
            ],
          },
        ],
      },
      // Platform administrators (password + authenticator code); the console loads on demand.
      {
        path: 'admin/login',
        element: <AuthLayout variant="admin" />,
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
            { path: 'settings', lazy: page(() => import('../features/admin/settings/AdminSettingsPage'), module => module.AdminSettingsPage) },
            { path: 'audit', lazy: page(() => import('../features/admin/audit/AdminAuditPage'), module => module.AdminAuditPage) },
          ],
        }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

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
import { OnboardingGate, RequireAuth, RequireGuest, RestaurantGate } from './router/guards';

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
              {
                path: 'settings',
                lazy: async () => ({ Component: (await import('../features/restaurant/settings/SettingsLayout')).SettingsLayout }),
                children: [
                  { index: true, lazy: async () => ({ Component: (await import('../features/restaurant/settings/ProfileSettings')).ProfileSettings }) },
                  { path: 'branding', lazy: async () => ({ Component: (await import('../features/restaurant/settings/BrandingSettings')).BrandingSettings }) },
                  { path: 'hours', lazy: async () => ({ Component: (await import('../features/restaurant/settings/OpeningHoursSettings')).OpeningHoursSettings }) },
                  { path: 'account', lazy: async () => ({ Component: (await import('../features/restaurant/settings/AccountSettings')).AccountSettings }) },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { RESTAURANT_ERROR_CODES } from '@bilhanah/contracts';
import { ErrorPanel } from '../../components/ErrorBoundary';
import { isApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useRestaurantQuery } from '../../features/restaurant/queries';
import { OwnerLayout } from '../../layouts/OwnerLayout';
import { Splash } from '../providers/SessionBootstrap';

/** Only same-app paths are accepted as a post-login destination. */
export function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

/** Signed-in owners only; others go to the login page and come back afterwards. */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();
  if (session.status === 'loading') return <Splash />;
  if (session.status === 'anonymous') {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace state={{ expired: session.reason === 'expired' }} />;
  }
  return <Outlet />;
}

/** Pages for signed-out visitors (login, register…); signed-in owners skip them. */
export function RequireGuest() {
  const session = useSession();
  const [params] = useSearchParams();
  if (session.status === 'authenticated') return <Navigate to={safeNext(params.get('next'))} replace />;
  return <Outlet />;
}

/** The owner shell needs a restaurant; owners without one finish onboarding first. */
export function RestaurantGate() {
  const restaurant = useRestaurantQuery();
  if (restaurant.isPending) return <Splash />;
  if (restaurant.isError) {
    if (isApiError(restaurant.error, RESTAURANT_ERROR_CODES.RESTAURANT_NOT_FOUND)) return <Navigate to="/onboarding" replace />;
    return <main className="state-page"><ErrorPanel error={restaurant.error} onRetry={() => void restaurant.refetch()} /></main>;
  }
  return <OwnerLayout restaurant={restaurant.data} />;
}

/** Onboarding is only for owners who have no restaurant yet. */
export function OnboardingGate() {
  const restaurant = useRestaurantQuery();
  if (restaurant.isPending) return <Splash />;
  if (restaurant.isSuccess) return <Navigate to="/" replace />;
  if (!isApiError(restaurant.error, RESTAURANT_ERROR_CODES.RESTAURANT_NOT_FOUND)) {
    return <main className="state-page"><ErrorPanel error={restaurant.error} onRetry={() => void restaurant.refetch()} /></main>;
  }
  return <Outlet />;
}

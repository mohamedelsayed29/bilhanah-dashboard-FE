import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { RESTAURANT_ERROR_CODES, type UserRole } from '@bilhanah/contracts';
import { ErrorPanel } from '../../components/ErrorBoundary';
import { isApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useRestaurantQuery } from '../../features/restaurant/queries';
import { OwnerLayout } from '../../layouts/OwnerLayout';
import { Splash } from '../providers/SessionBootstrap';

/** Where each role lands after signing in: administrators and kitchen screens have their own area. */
export function roleHome(role: UserRole): string {
  return role === 'ADMIN' ? '/admin' : role === 'KITCHEN' ? '/kitchen' : '/';
}

const within = (path: string, area: string) => path === area || path.startsWith(`${area}/`);
const pathRole = (path: string): UserRole => (within(path, '/admin') ? 'ADMIN' : within(path, '/kitchen') ? 'KITCHEN' : 'OWNER');

/** Only same-app paths for the signed-in role are accepted as a post-login destination. */
export function safeNext(value: string | null, role: UserRole = 'OWNER'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return roleHome(role);
  return pathRole(value) === role ? value : roleHome(role);
}

/** Sends a signed-out visitor to `login`, coming back to the current page afterwards. */
function ToLogin({ login, home, expired }: { login: string; home: string; expired: boolean }) {
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;
  return <Navigate to={next === home ? login : `${login}?next=${encodeURIComponent(next)}`} replace state={{ expired }} />;
}

/** Signed-in owners only; others go to the login page and come back afterwards. Administrators and kitchen screens go to their own area. */
export function RequireAuth() {
  const session = useSession();
  if (session.status === 'loading') return <Splash />;
  if (session.status === 'anonymous') return <ToLogin login="/login" home="/" expired={session.reason === 'expired'} />;
  if (session.user.role !== 'OWNER') return <Navigate to={roleHome(session.user.role)} replace />;
  return <Outlet />;
}

/** The kitchen screen: kitchen accounts only. They sign in on the owners' login page. */
export function RequireKitchen() {
  const session = useSession();
  if (session.status === 'loading') return <Splash />;
  if (session.status === 'anonymous') return <ToLogin login="/login" home="/kitchen" expired={session.reason === 'expired'} />;
  if (session.user.role !== 'KITCHEN') return <Navigate to={roleHome(session.user.role)} replace />;
  return <Outlet />;
}

/** The admin console: administrators only. Owners go back to their dashboard. */
export function RequireAdmin() {
  const session = useSession();
  if (session.status === 'loading') return <Splash />;
  if (session.status === 'anonymous') return <ToLogin login="/admin/login" home="/admin" expired={session.reason === 'expired'} />;
  if (session.user.role !== 'ADMIN') return <Navigate to={roleHome(session.user.role)} replace />;
  return <Outlet />;
}

/** Pages for signed-out visitors (login, register…); signed-in users skip them. */
export function RequireGuest() {
  const session = useSession();
  const [params] = useSearchParams();
  if (session.status === 'authenticated') return <Navigate to={safeNext(params.get('next'), session.user.role)} replace />;
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

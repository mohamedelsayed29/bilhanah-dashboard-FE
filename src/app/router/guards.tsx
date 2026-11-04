import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { useSession } from '../../lib/session';
import { Splash } from '../providers/SessionBootstrap';

/**
 * The admin console is for Bilhanah's administrators only. Its session (the admin refresh cookie)
 * can only belong to one; restaurant accounts sign in to the restaurants' dashboard instead.
 */
const HOME = '/admin';

const within = (path: string, area: string) => path === area || path.startsWith(`${area}/`);

/** Only console paths are accepted as a post-login destination. */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return HOME;
  return within(value, HOME) && !within(value, `${HOME}/login`) ? value : HOME;
}

/** Sends a signed-out visitor to the sign-in page, coming back to the current page afterwards. */
function ToLogin({ expired }: { expired: boolean }) {
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;
  const login = `${HOME}/login`;
  return <Navigate to={next === HOME ? login : `${login}?next=${encodeURIComponent(next)}`} replace state={{ expired }} />;
}

/** The console: administrators only. Any other account is signed out of this app. */
export function RequireAdmin() {
  const session = useSession();
  if (session.status === 'loading') return <Splash />;
  if (session.status === 'anonymous') return <ToLogin expired={session.reason === 'expired'} />;
  if (session.user.role !== 'ADMIN') return <Navigate to="/logout" replace />;
  return <Outlet />;
}

/** The sign-in page: administrators already signed in go on to the console. */
export function RequireGuest() {
  const session = useSession();
  const [params] = useSearchParams();
  if (session.status === 'authenticated') return <Navigate to={session.user.role === 'ADMIN' ? safeNext(params.get('next')) : '/logout'} replace />;
  return <Outlet />;
}

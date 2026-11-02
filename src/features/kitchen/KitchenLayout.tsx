import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router';
import { CookingPotIcon, SignOutIcon, StorefrontIcon } from '@phosphor-icons/react';
import type { KitchenContext } from '@bilhanah/contracts';
import { Brand } from '../../components/Brand';
import { ErrorBoundary, ErrorPanel } from '../../components/ErrorBoundary';
import { LanguageToggle } from '../../components/LanguageToggle';
import { useSignOut } from '../../components/SignOutDialog';
import { kitchenApi } from '../../lib/api/endpoints';
import { useLanguage } from '../../lib/language';
import { useSession } from '../../lib/session';
import { useRouteFocus } from '../../lib/use-route-focus';
import { Splash } from '../../app/providers/SessionBootstrap';
import { BranchScopeProvider, BranchSwitcher, useBranchScope } from '../branches/BranchScope';
import type { BranchOption } from '../branches/scope';
import { LiveForScope } from '../restaurant/orders/live';
import { queryKeys } from '../restaurant/queries';

export function useKitchenContextQuery() {
  return useQuery({ queryKey: queryKeys.kitchenContext, queryFn: kitchenApi.context });
}

/** The kitchen's restaurant inside the kitchen shell, where KitchenLayout guarantees it is loaded. */
export function useKitchenContext(): KitchenContext {
  const { data } = useKitchenContextQuery();
  if (!data) throw new Error('useKitchenContext() is only available inside the kitchen shell.');
  return data;
}

/**
 * The branches a staff account works at, as the branch scope: tied to one branch, or (all-branch
 * accounts) a branch chosen on this screen and remembered on it.
 */
export function StaffBranchScope({ context, children }: { context: KitchenContext; children: ReactNode }) {
  const session = useSession();
  const options = useMemo<BranchOption[]>(() => context.branches.map(branch => ({ ...branch, isActive: true })), [context.branches]);
  const userId = session.status === 'authenticated' ? session.user.id : 'staff';
  return <BranchScopeProvider branches={options} lockedTo={context.branch?.id ?? null} storageKey={`bilhanah:branch:v1:${userId}`}>{children}</BranchScopeProvider>;
}

/** Kitchen screen shell: one slim bar (restaurant, branch, signed-in screen, language, sign out) over the live board. */
export function KitchenLayout() {
  const context = useKitchenContextQuery();
  if (context.isPending) return <Splash />;
  if (context.isError) return <main className="state-page"><ErrorPanel error={context.error} onRetry={() => void context.refetch()} /></main>;
  return <StaffBranchScope context={context.data}>
    <LiveForScope enabled={context.data.ordering.included}><KitchenShell context={context.data} /></LiveForScope>
  </StaffBranchScope>;
}

function KitchenShell({ context }: { context: KitchenContext }) {
  const { text } = useLanguage();
  const session = useSession();
  const scope = useBranchScope();
  const { pathname } = useLocation();
  useRouteFocus();
  const signOut = useSignOut(text('هتخرج من حسابك على الجهاز ده، والطلبات الجديدة مش هتوصلك هنا لحد ما تدخل تاني.', 'You will be signed out on this device, and new orders will not reach it until you sign back in.'));
  const user = session.status === 'authenticated' ? session.user : null;
  // A branch name when there is one to show: the screen's own, or the one chosen here.
  const branchName = context.branch?.name ?? (context.branches.length > 1 ? scope.branch?.name ?? null : null);
  return <div className="kitchen-shell">
    <a className="skip-link" href="#main-content">{text('انتقل للمحتوى', 'Skip to content')}</a>
    <header className="kitchen-bar">
      <Brand inverse />
      <div className="kitchen-bar-place">
        <CookingPotIcon size={22} weight="bold" aria-hidden="true" />
        <strong><bdi>{context.restaurant.name}</bdi></strong>
        {branchName && !scope.multi && <span className="kitchen-bar-branch" data-testid="kitchen-branch"><StorefrontIcon size={16} weight="bold" aria-hidden="true" /><bdi>{branchName}</bdi></span>}
        <span className="kitchen-bar-role">{text('المطبخ', 'Kitchen')}</span>
      </div>
      <BranchSwitcher className="branch-switch-dark" />
      <div className="kitchen-bar-actions">
        {user && <span className="kitchen-bar-user"><bdi>{user.fullName}</bdi></span>}
        <LanguageToggle plain />
        <button type="button" className="icon-button" onClick={signOut.ask} aria-label={text('تسجيل الخروج', 'Sign out')} title={text('خروج', 'Sign out')}>
          <SignOutIcon size={21} className="directional" aria-hidden="true" />
        </button>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="kitchen-main">
      <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
    </main>
    {signOut.dialog}
  </div>;
}

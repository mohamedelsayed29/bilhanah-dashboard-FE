import { Fragment, useEffect, useMemo, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { ChartBarIcon, ForkKnifeIcon, GearSixIcon, ReceiptIcon, SignOutIcon, StorefrontIcon, TableIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { KitchenContext } from '@bilhanah/contracts';
import { Brand } from '../../components/Brand';
import { ErrorBoundary, ErrorPanel } from '../../components/ErrorBoundary';
import { LanguageToggle } from '../../components/LanguageToggle';
import { useSignOut } from '../../components/SignOutDialog';
import { Splash } from '../../app/providers/SessionBootstrap';
import { fallInto } from '../../lib/drop-motion';
import { useCopy } from '../../lib/copy';
import { useLanguage } from '../../lib/language';
import { useRouteFocus } from '../../lib/use-route-focus';
import { BranchSwitcher, useBranchScope } from '../branches/BranchScope';
import { managerWorkspace, WorkspaceProvider } from '../branches/workspace';
import { StaffBranchScope, useKitchenContextQuery } from '../kitchen/KitchenLayout';
import { LiveForScope, useOrdersLive } from '../restaurant/orders/live';
import { useBranchesQuery } from '../restaurant/queries';

type NavItem = { to: string; end?: boolean; icon: Icon; label: (t: ReturnType<typeof useCopy>) => string; orders?: boolean };
const NAV_GROUPS: { label: (t: ReturnType<typeof useCopy>) => string; items: NavItem[] }[] = [
  { label: t => t.manager.groupDaily, items: [
    { to: '/manager', end: true, icon: ReceiptIcon, label: t => t.manager.navOrders, orders: true },
    { to: '/manager/tables', icon: TableIcon, label: t => t.manager.navTables },
    { to: '/manager/insights', icon: ChartBarIcon, label: t => t.manager.navInsights },
  ] },
  { label: t => t.manager.groupSetup, items: [
    { to: '/manager/menu', icon: ForkKnifeIcon, label: t => t.manager.navMenu },
    { to: '/manager/settings', icon: GearSixIcon, label: t => t.manager.navSettings },
  ] },
];
const NAV = NAV_GROUPS.flatMap(group => group.items);

/**
 * A branch manager's dashboard: the owner's shell, cut down to running one branch (orders, floor
 * and tables, the branch's menu changes, its settings and insights). Managers working at every
 * branch get the branch switcher.
 */
export function ManagerLayout() {
  const context = useKitchenContextQuery();
  const branches = useBranchesQuery();
  const restaurant = context.data?.restaurant;
  const workspace = useMemo(() => managerWorkspace({ name: restaurant?.name ?? '', subdomain: restaurant?.subdomain ?? '', logoUrl: null, brandColor: null }), [restaurant?.name, restaurant?.subdomain]);
  if (context.isPending || branches.isPending) return <Splash />;
  if (context.isError || branches.isError) {
    const failed = context.isError ? context : branches;
    return <main className="state-page"><ErrorPanel error={failed.error} onRetry={() => void failed.refetch()} /></main>;
  }
  if (context.data.branches.length === 0 || branches.data.branches.every(branch => !branch.isActive)) return <NoBranch />;
  return <WorkspaceProvider value={workspace}>
    <StaffBranchScope context={context.data}>
      <LiveForScope enabled={context.data.ordering.included}><ManagerShell context={context.data} /></LiveForScope>
    </StaffBranchScope>
  </WorkspaceProvider>;
}

function NoBranch() {
  const t = useCopy();
  const signOut = useSignOut(t.manager.signOutNote);
  return <main className="state-page"><div className="state-card">
    <span className="empty-state-icon" aria-hidden="true"><StorefrontIcon size={30} /></span>
    <p>{t.manager.noBranch}</p>
    <button type="button" className="button button-secondary" onClick={signOut.ask}><SignOutIcon size={18} className="directional" aria-hidden="true" />{t.common.signOut}</button>
    {signOut.dialog}
  </div></main>;
}

function NewOrdersCount() {
  const { number } = useLanguage();
  const { newCount } = useOrdersLive();
  if (newCount <= 0) return null;
  return <span className="nav-count" data-testid="new-orders-count"><span aria-hidden="true">{number(newCount)}</span></span>;
}

function ManagerShell({ context }: { context: KitchenContext }) {
  const t = useCopy();
  const { text } = useLanguage();
  const { pathname } = useLocation();
  const scope = useBranchScope();
  useRouteFocus();
  const { arrivals } = useOrdersLive();
  const ordersLinks = useRef<{ sidebar: HTMLAnchorElement | null; tabbar: HTMLAnchorElement | null }>({ sidebar: null, tabbar: null });
  useEffect(() => {
    if (arrivals === 0) return;
    const { sidebar, tabbar } = ordersLinks.current;
    fallInto(sidebar?.getClientRects().length ? sidebar : tabbar);
  }, [arrivals]);
  const signOut = useSignOut(t.manager.signOutNote);
  const branchName = context.branch?.name ?? scope.branch?.name ?? null;
  return <div className="owner-shell manager-shell">
    <a className="skip-link" href="#main-content">{text('انتقل للمحتوى', 'Skip to content')}</a>
    <div className="sidebar-column"><aside className="sidebar">
      <div className="sidebar-brand"><Brand mark /></div>
      <nav aria-label={t.manager.navigation} className="sidebar-nav">
        {NAV_GROUPS.map(group => <Fragment key={group.items[0]!.to}>
          <p className="sidebar-group">{group.label(t)}</p>
          {group.items.map(item => <NavLink key={item.to} to={item.to} end={item.end} className="sidebar-link" ref={item.orders ? element => { ordersLinks.current.sidebar = element; } : undefined}>
            <span className="sidebar-icon"><item.icon size={21} aria-hidden="true" /></span><span className="sidebar-label">{item.label(t)}</span>
            {item.orders && <NewOrdersCount />}
          </NavLink>)}
        </Fragment>)}
        <button type="button" className="sidebar-link sidebar-signout" onClick={signOut.ask}><span className="sidebar-icon"><SignOutIcon size={21} className="directional" aria-hidden="true" /></span><span className="sidebar-label">{t.common.signOut}</span></button>
      </nav>
      <div className="sidebar-footer"><LanguageToggle round /></div>
    </aside></div>
    <header className="topbar">
      <div className="topbar-restaurant">
        <StorefrontIcon size={22} weight="bold" aria-hidden="true" />
        <strong><bdi>{context.restaurant.name}</bdi></strong>
      </div>
      <div className="topbar-actions">
        <LanguageToggle plain />
        <button type="button" className="icon-button" onClick={signOut.ask} aria-label={t.common.signOut}><SignOutIcon size={21} className="directional" /></button>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="owner-main">
      <div className="owner-content">
        <div className="manager-context" data-testid="manager-context">
          <p className="manager-place">
            <span className="manager-restaurant"><bdi>{context.restaurant.name}</bdi></span>
            {branchName && !scope.multi && <strong className="manager-branch" data-testid="manager-branch"><bdi>{branchName}</bdi></strong>}
            <span className="badge badge-guava">{t.manager.roleTag}</span>
          </p>
          <BranchSwitcher className="owner-branch-switch" />
        </div>
        <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
      </div>
    </main>
    <nav className="tabbar" aria-label={t.manager.tabs}>
      {NAV.map(item => <NavLink key={item.to} to={item.to} end={item.end} className="tabbar-link" ref={item.orders ? element => { ordersLinks.current.tabbar = element; } : undefined}>
        {({ isActive }) => <>
          <span className="tabbar-icon"><item.icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />{item.orders && <NewOrdersCount />}</span>
          <span>{item.label(t)}</span>
        </>}
      </NavLink>)}
    </nav>
    {signOut.dialog}
  </div>;
}

import { Fragment } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { BellIcon, ChartBarIcon, ChartLineUpIcon, ClipboardTextIcon, GearSixIcon, PackageIcon, ReceiptIcon, ShieldCheckIcon, SignOutIcon, StorefrontIcon } from '@phosphor-icons/react';
import type { AdminOverview } from '@bilhanah/contracts';
import type { Icon } from '@phosphor-icons/react';
import { Brand } from '../components/Brand';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LanguageToggle } from '../components/LanguageToggle';
import { useSignOut } from '../components/SignOutDialog';
import { useAdminOverview } from '../features/admin/queries';
import { useLanguage } from '../lib/language';
import { useRouteFocus } from '../lib/use-route-focus';

/** `count`: the overview figure shown as a badge. `phone`: also in the bottom tab bar (five fit; reports and the audit log are linked from the overview). */
type NavItem = { to: string; end?: boolean; icon: Icon; ar: string; en: string; short?: [string, string]; count?: 'pendingPayments' | 'newStandOrders'; phone?: boolean };
/** The sidebar in two labelled groups: what needs doing, then the platform's records and setup. */
const NAV_GROUPS: { ar: string; en: string; items: NavItem[] }[] = [
  { ar: 'المتابعة', en: 'Daily work', items: [
    { to: '/admin', end: true, icon: ChartLineUpIcon, ar: 'نظرة عامة', en: 'Overview', short: ['الرئيسية', 'Overview'], phone: true },
    { to: '/admin/payments', icon: ReceiptIcon, ar: 'التحويلات', en: 'Payments', count: 'pendingPayments', phone: true },
    { to: '/admin/stand-orders', icon: PackageIcon, ar: 'طلبات الستاندات', en: 'Stand orders', short: ['الستاندات', 'Stands'], count: 'newStandOrders', phone: true },
    { to: '/admin/restaurants', icon: StorefrontIcon, ar: 'المطاعم', en: 'Restaurants', phone: true },
  ] },
  { ar: 'التقارير والإعداد', en: 'Records and setup', items: [
    { to: '/admin/stats', icon: ChartBarIcon, ar: 'التقارير', en: 'Reports' },
    { to: '/admin/audit', icon: ClipboardTextIcon, ar: 'سجل المراجعة', en: 'Audit log', short: ['السجل', 'Audit'] },
    { to: '/admin/settings', icon: GearSixIcon, ar: 'الإعدادات', en: 'Settings', phone: true },
  ] },
];
const NAV = NAV_GROUPS.flatMap(group => group.items);
/** The bottom tab bar keeps its familiar order. */
const PHONE_NAV = ['/admin', '/admin/payments', '/admin/stand-orders', '/admin/restaurants', '/admin/settings'].map(to => NAV.find(item => item.to === to)!);

function NavCount({ kind, overview, testId }: { kind: NavItem['count']; overview: AdminOverview | undefined; testId?: string }) {
  const { number, count: counted } = useLanguage();
  const count = kind && overview ? overview[kind] ?? 0 : 0;
  if (count <= 0) return null;
  return <span className="nav-count" data-testid={testId ?? (kind === 'pendingPayments' ? 'pending-count' : 'stand-orders-count')}>
    <span aria-hidden="true">{number(count)}</span>
    <span className="visually-hidden">({kind === 'pendingPayments'
      ? counted(count, [{ one: 'تحويل مستني المراجعة', two: 'تحويلين مستنيين المراجعة', few: '{n} تحويلات مستنية المراجعة', many: '{n} تحويل مستني المراجعة' }, { one: '{n} waiting for review', other: '{n} waiting for review' }])
      : counted(count, [{ one: 'طلب جديد', two: 'طلبين جداد', few: '{n} طلبات جديدة', many: '{n} طلب جديد' }, { one: '{n} new', other: '{n} new' }])})</span>
  </span>;
}

/** Admin console shell: the owner shell's structure, marked as the admin console with its own colors. */
export function AdminLayout() {
  const { text } = useLanguage();
  const { pathname } = useLocation();
  const overview = useAdminOverview();
  useRouteFocus();
  const signOut = useSignOut();
  return <div className="owner-shell admin-shell">
    <a className="skip-link" href="#main-content">{text('انتقل للمحتوى', 'Skip to content')}</a>
    <div className="sidebar-column"><aside className="sidebar">
      <div className="sidebar-brand">
        <Brand to="/admin" mark />
        <span className="admin-tag"><ShieldCheckIcon size={12} weight="fill" aria-hidden="true" />{text('إدارة', 'Admin')}</span>
      </div>
      <nav aria-label={text('قائمة الإدارة', 'Admin navigation')} className="sidebar-nav">
        {NAV_GROUPS.map(group => <Fragment key={group.en}>
          <p className="sidebar-group">{text(group.ar, group.en)}</p>
          {group.items.map(item => <NavLink key={item.to} to={item.to} end={item.end} className="sidebar-link">
            <span className="sidebar-icon"><item.icon size={21} aria-hidden="true" /></span><span className="sidebar-label">{text(item.ar, item.en)}</span>
            <NavCount kind={item.count} overview={overview.data} />
          </NavLink>)}
        </Fragment>)}
        <button type="button" className="sidebar-link sidebar-signout" onClick={signOut.ask}><span className="sidebar-icon"><SignOutIcon size={21} className="directional" aria-hidden="true" /></span><span className="sidebar-label">{text('تسجيل الخروج', 'Sign out')}</span></button>
      </nav>
      <div className="sidebar-footer">
        <NavLink to="/admin/payments" className="sidebar-round" title={text('تحويلات مستنية المراجعة', 'Payments waiting for review')}>
          <BellIcon size={19} weight="bold" aria-hidden="true" /><span className="visually-hidden">{text('تحويلات مستنية المراجعة', 'Payments waiting for review')}</span>
          <NavCount kind="pendingPayments" overview={overview.data} testId="sidebar-pending-payments" />
        </NavLink>
        <LanguageToggle round />
      </div>
    </aside></div>
    <header className="topbar">
      <div className="topbar-restaurant">
        <img className="topbar-mark" src="/brand/bilhanah-mark.svg" alt="" width="445" height="479" />
        <span className="topbar-console"><strong>{text('بالهنا', 'Bilhanah')}</strong><small>{text('لوحة الإدارة', 'Admin console')}</small></span>
      </div>
      <div className="topbar-actions">
        <LanguageToggle plain />
        <button type="button" className="icon-button" onClick={signOut.ask} aria-label={text('تسجيل الخروج', 'Sign out')}><SignOutIcon size={21} className="directional" /></button>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="owner-main">
      <div className="owner-content admin-content">
        <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
      </div>
    </main>
    <nav className="tabbar" aria-label={text('التنقل', 'Navigation')}>
      {PHONE_NAV.map(item => <NavLink key={item.to} to={item.to} end={item.end} className="tabbar-link">
        {({ isActive }) => <>
          <span className="tabbar-icon"><item.icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" /><NavCount kind={item.count} overview={overview.data} /></span>
          <span>{item.short ? text(...item.short) : text(item.ar, item.en)}</span>
        </>}
      </NavLink>)}
    </nav>
    {signOut.dialog}
  </div>;
}

import { NavLink, Outlet, useLocation } from 'react-router';
import { ChartLineUpIcon, ClipboardTextIcon, GearSixIcon, ReceiptIcon, ShieldCheckIcon, SignOutIcon, StorefrontIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { Brand } from '../components/Brand';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LanguageToggle } from '../components/LanguageToggle';
import { useAdminOverview } from '../features/admin/queries';
import { useLanguage } from '../lib/language';
import { useSession } from '../lib/session';
import { useRouteFocus } from '../lib/use-route-focus';

type NavItem = { to: string; end?: boolean; icon: Icon; ar: string; en: string; short?: [string, string]; pending?: boolean };
const NAV: NavItem[] = [
  { to: '/admin', end: true, icon: ChartLineUpIcon, ar: 'نظرة عامة', en: 'Overview', short: ['الرئيسية', 'Overview'] },
  { to: '/admin/payments', icon: ReceiptIcon, ar: 'التحويلات', en: 'Payments', pending: true },
  { to: '/admin/restaurants', icon: StorefrontIcon, ar: 'المطاعم', en: 'Restaurants' },
  { to: '/admin/settings', icon: GearSixIcon, ar: 'الإعدادات', en: 'Settings' },
  { to: '/admin/audit', icon: ClipboardTextIcon, ar: 'سجل المراجعة', en: 'Audit log', short: ['السجل', 'Audit'] },
];

function PendingCount({ count, inverse = false }: { count: number; inverse?: boolean }) {
  const { text, number } = useLanguage();
  if (count <= 0) return null;
  return <span className={`nav-count ${inverse ? 'nav-count-on-dark' : ''}`} data-testid="pending-count">
    <span aria-hidden="true">{number(count)}</span>
    <span className="visually-hidden">{text(`(${number(count)} مستني المراجعة)`, `(${count} waiting for review)`)}</span>
  </span>;
}

/** Admin console shell: the owner shell's structure, marked as the admin console with its own colors. */
export function AdminLayout() {
  const { text } = useLanguage();
  const session = useSession();
  const { pathname } = useLocation();
  const overview = useAdminOverview();
  useRouteFocus();
  const user = session.status === 'authenticated' ? session.user : null;
  const pending = overview.data?.pendingPayments ?? 0;
  return <div className="owner-shell admin-shell">
    <a className="skip-link" href="#main-content">{text('انتقل للمحتوى', 'Skip to content')}</a>
    <div className="sidebar-column"><aside className="sidebar">
      <div className="sidebar-brand"><Brand inverse to="/admin" /></div>
      <div className="admin-tag"><ShieldCheckIcon size={18} weight="fill" aria-hidden="true" /><span>{text('لوحة الإدارة', 'Admin console')}</span></div>
      <nav aria-label={text('قائمة الإدارة', 'Admin navigation')} className="sidebar-nav">
        {NAV.map(item => <NavLink key={item.to} to={item.to} end={item.end} className="sidebar-link">
          <item.icon size={21} aria-hidden="true" />{text(item.ar, item.en)}
          {item.pending && <PendingCount count={pending} inverse />}
        </NavLink>)}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <strong>{user?.fullName}</strong>
          <small className="ltr">{user?.email}</small>
        </div>
        <div className="sidebar-actions">
          <LanguageToggle plain />
          <NavLink to="/logout" className="sidebar-signout"><SignOutIcon size={18} className="directional" aria-hidden="true" />{text('خروج', 'Sign out')}</NavLink>
        </div>
      </div>
    </aside></div>
    <header className="topbar">
      <div className="topbar-restaurant">
        <img className="topbar-mark" src="/brand/bilhanah-mark.svg" alt="" width="445" height="479" />
        <strong>{text('بالهنا', 'Bilhanah')}</strong>
        <span className="admin-badge"><ShieldCheckIcon size={14} weight="fill" aria-hidden="true" />{text('إدارة', 'Admin')}</span>
      </div>
      <div className="topbar-actions">
        <LanguageToggle plain />
        <NavLink to="/logout" className="icon-button" aria-label={text('تسجيل الخروج', 'Sign out')}><SignOutIcon size={21} className="directional" /></NavLink>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="owner-main">
      <div className="owner-content admin-content">
        <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
      </div>
    </main>
    <nav className="tabbar" aria-label={text('التنقل', 'Navigation')}>
      {NAV.map(item => <NavLink key={item.to} to={item.to} end={item.end} className="tabbar-link">
        {({ isActive }) => <>
          <span className="tabbar-icon"><item.icon size={24} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />{item.pending && <PendingCount count={pending} />}</span>
          <span>{item.short ? text(...item.short) : text(item.ar, item.en)}</span>
        </>}
      </NavLink>)}
    </nav>
  </div>;
}

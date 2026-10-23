import { NavLink, Outlet, useLocation } from 'react-router';
import { ArrowSquareOutIcon, CreditCardIcon, ForkKnifeIcon, GearSixIcon, HouseIcon, QrCodeIcon, SignOutIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { OwnerRestaurant } from '@bilhanah/contracts';
import { Brand } from '../components/Brand';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LanguageToggle } from '../components/LanguageToggle';
import { AccessBadge } from '../features/restaurant/access';
import { useLanguage } from '../lib/language';
import { useSession } from '../lib/session';
import { useRouteFocus } from '../lib/use-route-focus';

type NavItem = { to: string; end?: boolean; icon: Icon; ar: string; en: string };
const NAV: NavItem[] = [
  { to: '/', end: true, icon: HouseIcon, ar: 'الرئيسية', en: 'Overview' },
  { to: '/menu', icon: ForkKnifeIcon, ar: 'المنيو', en: 'Menu' },
  { to: '/qr-codes', icon: QrCodeIcon, ar: 'كود QR', en: 'QR code' },
  { to: '/subscription', icon: CreditCardIcon, ar: 'الاشتراك', en: 'Subscription' },
  { to: '/settings', icon: GearSixIcon, ar: 'الإعدادات', en: 'Settings' },
];

export function RestaurantAvatar({ restaurant, size = 40 }: { restaurant: OwnerRestaurant; size?: number }) {
  const logo = restaurant.logo?.sources[0]?.url ?? restaurant.logo?.url;
  return <span className="restaurant-avatar" style={{ width: size, height: size, background: restaurant.brandColor ?? undefined }} aria-hidden="true">
    {logo ? <img src={logo} alt="" /> : restaurant.name.trim().charAt(0)}
  </span>;
}

/** Owner shell: sidebar on desktop; top bar and bottom tab bar on phones. */
export function OwnerLayout({ restaurant }: { restaurant: OwnerRestaurant }) {
  const { text } = useLanguage();
  const session = useSession();
  const { pathname } = useLocation();
  useRouteFocus();
  const user = session.status === 'authenticated' ? session.user : null;
  return <div className="owner-shell">
    <a className="skip-link" href="#main-content">{text('انتقل للمحتوى', 'Skip to content')}</a>
    <div className="sidebar-column"><aside className="sidebar">
      <div className="sidebar-brand"><Brand inverse /></div>
      <div className="sidebar-restaurant">
        <RestaurantAvatar restaurant={restaurant} />
        <div>
          <strong>{restaurant.name}</strong>
          <AccessBadge access={restaurant.access} inverse />
        </div>
      </div>
      <nav aria-label={text('القائمة الرئيسية', 'Main navigation')} className="sidebar-nav">
        {NAV.map(item => <NavLink key={item.to} to={item.to} end={item.end} className="sidebar-link">
          <item.icon size={21} aria-hidden="true" />{text(item.ar, item.en)}
        </NavLink>)}
      </nav>
      <a className="sidebar-preview" href={restaurant.publicUrl} target="_blank" rel="noreferrer">
        <ArrowSquareOutIcon size={19} aria-hidden="true" />
        <span>{text('شوف المنيو زي الزبون', 'View your public menu')}<small className="ltr">{restaurant.publicUrl.replace(/^https?:\/\//, '')}</small></span>
      </a>
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
        <RestaurantAvatar restaurant={restaurant} size={34} />
        <strong>{restaurant.name}</strong>
      </div>
      <div className="topbar-actions">
        <LanguageToggle plain />
        <NavLink to="/logout" className="icon-button" aria-label={text('تسجيل الخروج', 'Sign out')}><SignOutIcon size={21} className="directional" /></NavLink>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="owner-main">
      <div className="owner-content">
        <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
      </div>
    </main>
    <nav className="tabbar" aria-label={text('التنقل', 'Navigation')}>
      {NAV.map(item => <NavLink key={item.to} to={item.to} end={item.end} className="tabbar-link">
        {({ isActive }) => <><item.icon size={24} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" /><span>{text(item.ar, item.en)}</span></>}
      </NavLink>)}
    </nav>
  </div>;
}

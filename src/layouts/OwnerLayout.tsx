import { Fragment, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { ArrowSquareOutIcon, BellIcon, ChartBarIcon, CreditCardIcon, ForkKnifeIcon, GearSixIcon, HouseIcon, QrCodeIcon, ReceiptIcon, SignOutIcon, TableIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { OwnerRestaurant } from '@bilhanah/contracts';
import { Brand } from '../components/Brand';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LanguageToggle } from '../components/LanguageToggle';
import { useSignOut } from '../components/SignOutDialog';
import { OrdersLiveProvider, useOrdersLive } from '../features/restaurant/orders/live';
import { fallInto } from '../lib/drop-motion';
import { useLanguage } from '../lib/language';
import { useRouteFocus } from '../lib/use-route-focus';

/** `phone`: also in the bottom tab bar (five fit at 390 px; insights, the QR code and subscription are linked from the overview). */
type NavItem = { to: string; end?: boolean; icon: Icon; ar: string; en: string; phone?: boolean; orders?: boolean };
/** The sidebar in two labelled groups: the day's work, then the restaurant's setup. */
const NAV_GROUPS: { ar: string; en: string; items: NavItem[] }[] = [
  { ar: 'الشغل اليومي', en: 'Daily work', items: [
    { to: '/', end: true, icon: HouseIcon, ar: 'الرئيسية', en: 'Overview', phone: true },
    { to: '/orders', icon: ReceiptIcon, ar: 'الطلبات', en: 'Orders', phone: true, orders: true },
    { to: '/tables', icon: TableIcon, ar: 'الطاولات', en: 'Tables', phone: true },
    { to: '/insights', icon: ChartBarIcon, ar: 'الإحصائيات', en: 'Insights' },
  ] },
  { ar: 'إعداد المطعم', en: 'Your restaurant', items: [
    { to: '/menu', icon: ForkKnifeIcon, ar: 'المنيو', en: 'Menu', phone: true },
    { to: '/qr-codes', icon: QrCodeIcon, ar: 'كود QR', en: 'QR code' },
    { to: '/subscription', icon: CreditCardIcon, ar: 'الاشتراك', en: 'Subscription' },
    { to: '/settings', icon: GearSixIcon, ar: 'الإعدادات', en: 'Settings', phone: true },
  ] },
];
const NAV = NAV_GROUPS.flatMap(group => group.items);
/** The bottom tab bar keeps its familiar order. */
const PHONE_NAV = ['/', '/orders', '/menu', '/tables', '/settings'].map(to => NAV.find(item => item.to === to)!);

/** Orders waiting to be accepted, on the Orders navigation item. */
function NewOrdersCount({ testId = 'new-orders-count' }: { testId?: string }) {
  const { number, count } = useLanguage();
  const { newCount } = useOrdersLive();
  if (newCount <= 0) return null;
  return <span className="nav-count" data-testid={testId}>
    <span aria-hidden="true">{number(newCount)}</span>
    <span className="visually-hidden">({count(newCount, [{ one: 'طلب جديد', two: 'طلبين جداد', few: '{n} طلبات جديدة', many: '{n} طلب جديد' }, { one: '{n} new', other: '{n} new' }])})</span>
  </span>;
}

export function RestaurantAvatar({ restaurant, size = 40 }: { restaurant: OwnerRestaurant; size?: number }) {
  const logo = restaurant.logo?.sources[0]?.url ?? restaurant.logo?.url;
  return <span className="restaurant-avatar" style={{ width: size, height: size, background: restaurant.brandColor ?? undefined }} aria-hidden="true">
    {logo ? <img src={logo} alt="" /> : restaurant.name.trim().charAt(0)}
  </span>;
}

/** Owner shell: sidebar on desktop; top bar and bottom tab bar on phones. The order board stays live on every page. */
export function OwnerLayout({ restaurant }: { restaurant: OwnerRestaurant }) {
  return <OrdersLiveProvider enabled={restaurant.ordering.included}><OwnerShell restaurant={restaurant} /></OrdersLiveProvider>;
}

function OwnerShell({ restaurant }: { restaurant: OwnerRestaurant }) {
  const { text } = useLanguage();
  const { pathname } = useLocation();
  useRouteFocus();
  // A new order falls like a drop onto Orders: in the sidebar, or in the tab bar on phones.
  const { arrivals } = useOrdersLive();
  const ordersLinks = useRef<{ sidebar: HTMLAnchorElement | null; tabbar: HTMLAnchorElement | null }>({ sidebar: null, tabbar: null });
  useEffect(() => {
    if (arrivals === 0) return;
    const { sidebar, tabbar } = ordersLinks.current;
    fallInto(sidebar?.getClientRects().length ? sidebar : tabbar);
  }, [arrivals]);
  const signOut = useSignOut(text('هتخرج من حسابك على الجهاز ده، والطلبات الجديدة مش هتوصلك هنا لحد ما تدخل تاني.', 'You will be signed out on this device, and new orders will not reach it until you sign back in.'));
  return <div className="owner-shell">
    <a className="skip-link" href="#main-content">{text('انتقل للمحتوى', 'Skip to content')}</a>
    <div className="sidebar-column"><aside className="sidebar">
      <div className="sidebar-brand"><Brand mark /></div>
      <nav aria-label={text('القائمة الرئيسية', 'Main navigation')} className="sidebar-nav">
        {NAV_GROUPS.map(group => <Fragment key={group.en}>
          <p className="sidebar-group">{text(group.ar, group.en)}</p>
          {group.items.map(item => <NavLink key={item.to} to={item.to} end={item.end} className="sidebar-link" ref={item.orders ? element => { ordersLinks.current.sidebar = element; } : undefined}>
            <span className="sidebar-icon"><item.icon size={21} aria-hidden="true" /></span><span className="sidebar-label">{text(item.ar, item.en)}</span>
            {item.orders && <NewOrdersCount />}
          </NavLink>)}
        </Fragment>)}
        <button type="button" className="sidebar-link sidebar-signout" onClick={signOut.ask}><span className="sidebar-icon"><SignOutIcon size={21} className="directional" aria-hidden="true" /></span><span className="sidebar-label">{text('تسجيل الخروج', 'Sign out')}</span></button>
      </nav>
      <div className="sidebar-footer">
        <a className="sidebar-round" href={restaurant.publicUrl} target="_blank" rel="noreferrer"
          aria-label={text(`شوف المنيو زي الزبون: ${restaurant.publicUrl.replace(/^https?:\/\//, '')}`, `View your public menu: ${restaurant.publicUrl.replace(/^https?:\/\//, '')}`)}
          title={text('شوف المنيو زي الزبون', 'View your public menu')}>
          <ArrowSquareOutIcon size={19} weight="bold" aria-hidden="true" />
        </a>
        {restaurant.ordering.included && <NavLink to="/orders" className="sidebar-round" title={text('الطلبات الجديدة', 'New orders')}>
          <BellIcon size={19} weight="bold" aria-hidden="true" /><span className="visually-hidden">{text('الطلبات الجديدة', 'New orders')}</span><NewOrdersCount testId="sidebar-new-orders" />
        </NavLink>}
        <LanguageToggle round />
      </div>
    </aside></div>
    <header className="topbar">
      <div className="topbar-restaurant">
        <RestaurantAvatar restaurant={restaurant} size={32} />
        <strong><bdi>{restaurant.name}</bdi></strong>
      </div>
      <div className="topbar-actions">
        <LanguageToggle plain />
        <button type="button" className="icon-button" onClick={signOut.ask} aria-label={text('تسجيل الخروج', 'Sign out')}><SignOutIcon size={21} className="directional" /></button>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="owner-main">
      <div className="owner-content">
        <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
      </div>
    </main>
    <nav className="tabbar" aria-label={text('التنقل', 'Navigation')}>
      {PHONE_NAV.map(item => <NavLink key={item.to} to={item.to} end={item.end} className="tabbar-link" ref={item.orders ? element => { ordersLinks.current.tabbar = element; } : undefined}>
        {({ isActive }) => <>
          <span className="tabbar-icon"><item.icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />{item.orders && <NewOrdersCount />}</span>
          <span>{text(item.ar, item.en)}</span>
        </>}
      </NavLink>)}
    </nav>
    {signOut.dialog}
  </div>;
}

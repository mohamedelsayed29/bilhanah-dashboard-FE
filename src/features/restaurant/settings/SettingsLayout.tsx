import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { PageHeader } from '../../../components/PageHeader';
import { useLanguage } from '../../../lib/language';

/** Scrolls a sideways tab strip so its current tab is fully visible, in either reading direction. */
export function scrollTabIntoView(strip: HTMLElement | null) {
  const tab = strip?.querySelector<HTMLElement>('.active');
  if (!strip || !tab) return;
  const outer = strip.getBoundingClientRect();
  const inner = tab.getBoundingClientRect();
  if (inner.left < outer.left) strip.scrollLeft -= outer.left - inner.left + 16;
  else if (inner.right > outer.right) strip.scrollLeft += inner.right - outer.right + 16;
}

export function SettingsLayout() {
  const { text } = useLanguage();
  const { pathname } = useLocation();
  const nav = useRef<HTMLElement>(null);
  // On phones the tabs scroll sideways; keep the current one in view.
  // Only the tab strip scrolls (scrollIntoView could also move the page).
  useEffect(() => { scrollTabIntoView(nav.current); }, [pathname]);
  const tabs = [
    { to: '/settings', end: true, label: text('بيانات المطعم', 'Restaurant') },
    { to: '/settings/branding', label: text('الشكل والألوان', 'Branding') },
    { to: '/settings/hours', label: text('مواعيد الشغل', 'Opening hours') },
    { to: '/settings/ordering', label: text('الطلبات', 'Ordering') },
    { to: '/settings/account', label: text('الحساب والأمان', 'Account') },
  ];
  return <div className="page">
    <PageHeader title={text('الإعدادات', 'Settings')} />
    <nav ref={nav} className="tabs" aria-label={text('أقسام الإعدادات', 'Settings sections')}>
      {tabs.map(tab => <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab">{tab.label}</NavLink>)}
    </nav>
    <Outlet />
  </div>;
}

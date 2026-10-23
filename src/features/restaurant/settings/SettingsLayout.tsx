import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { ClockIcon, PaletteIcon, ReceiptIcon, StorefrontIcon, UserCircleIcon } from '@phosphor-icons/react';
import { PageHeader } from '../../../components/PageHeader';
import { useLanguage } from '../../../lib/language';

export function SettingsLayout() {
  const { text } = useLanguage();
  const { pathname } = useLocation();
  const nav = useRef<HTMLElement>(null);
  // On phones the tabs scroll sideways; keep the current one in view.
  useEffect(() => { nav.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [pathname]);
  const tabs = [
    { to: '/settings', end: true, icon: StorefrontIcon, label: text('بيانات المطعم', 'Restaurant') },
    { to: '/settings/branding', icon: PaletteIcon, label: text('الشكل والألوان', 'Branding') },
    { to: '/settings/hours', icon: ClockIcon, label: text('مواعيد الشغل', 'Opening hours') },
    { to: '/settings/ordering', icon: ReceiptIcon, label: text('الطلبات', 'Ordering') },
    { to: '/settings/account', icon: UserCircleIcon, label: text('الحساب والأمان', 'Account') },
  ];
  return <div className="page">
    <PageHeader title={text('الإعدادات', 'Settings')} description={text('بيانات مطعمك وشكل المنيو ومواعيد الشغل والطلبات وأمان حسابك.', 'Your restaurant details, menu look, opening hours, ordering and account security.')} />
    <nav ref={nav} className="tabs" aria-label={text('أقسام الإعدادات', 'Settings sections')}>
      {tabs.map(tab => <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab"><tab.icon size={18} aria-hidden="true" />{tab.label}</NavLink>)}
    </nav>
    <Outlet />
  </div>;
}

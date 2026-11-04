import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { CreditCardIcon, GiftIcon, PackageIcon, TagIcon } from '@phosphor-icons/react';
import type { AdminSettings } from '@bilhanah/contracts';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { PageSkeleton } from '../../../components/Skeleton';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { planName } from '../../billing/labels';
import { scrollTabIntoView } from '../../restaurant/settings/SettingsLayout';
import { useAdminSettingsQuery, useShopSettingsQuery } from '../queries';
import { methodsShown } from './payment-methods';

/**
 * The platform settings in the same shell as a restaurant's: a list of sections (each with a
 * one-line state of what is set), and one focused section at a time beside it.
 */
export function AdminSettingsLayout() {
  const { text, number } = useLanguage();
  usePageTitle('الإعدادات', 'Settings');
  const { pathname } = useLocation();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => { scrollTabIntoView(nav.current); }, [pathname]);
  const settings = useAdminSettingsQuery();
  const shop = useShopSettingsQuery();

  if (settings.isPending) return <PageSkeleton blocks={3} />;
  if (settings.isError) return <div className="page"><ErrorPanel error={settings.error} onRetry={() => void settings.refetch()} /></div>;
  const data: AdminSettings = settings.data;
  const shown = methodsShown(data.payment);
  const sections = [
    {
      to: '/admin/settings', end: true, icon: CreditCardIcon, label: text('بيانات الدفع', 'Payment details'),
      hint: shown.length ? text(`${number(shown.length)} من ٣ طرق ظاهرة للمطاعم`, `${shown.length} of 3 methods shown`) : text('مفيش طريقة ظاهرة', 'No method shown yet'),
    },
    {
      to: '/admin/settings/shop', icon: PackageIcon, label: text('متجر الستاندات', 'Stand shop'),
      hint: !shop.data ? text('التوصيل وطرق الدفع', 'Delivery and payment')
        : shop.data.deliveryFeePiastres === null ? text('التوصيل بالتليفون', 'Delivery by phone')
          : shop.data.deliveryFeePiastres === 0 ? text('توصيل مجاني', 'Free delivery') : text('رسوم توصيل ثابتة', 'Fixed delivery fee'),
    },
    {
      to: '/admin/settings/trial', icon: GiftIcon, label: text('التجربة المجانية', 'Free trial'),
      hint: data.trial.enabled ? text(`${number(data.trial.durationDays)} يوم · ${planName(data.trial.planCode, text)}`, `${data.trial.durationDays} days · ${planName(data.trial.planCode, text)}`) : text('مقفولة', 'Off'),
    },
    { to: '/admin/settings/plans', icon: TagIcon, label: text('أسعار الباقات', 'Plan prices'), hint: text(`${number(data.plans.length)} باقات بالشهر`, `${data.plans.length} monthly plans`) },
  ];

  return <div className="page settings-page admin-settings-page">
    <PageHeader title={text('الإعدادات', 'Settings')}
      description={text('إعدادات المنصة كلها في مكان واحد: بيانات الدفع للمطاعم، ومتجر الستاندات، والتجربة المجانية، وأسعار الباقات. كل تغيير بيتسجّل في سجل المراجعة.',
        'Every platform setting in one place: payment details for owners, the stand shop, the free trial and plan prices. Each change is recorded in the audit log.')} />
    <div className="settings-shell">
      <nav ref={nav} className="settings-nav" aria-label={text('أقسام الإعدادات', 'Settings sections')}>
        {sections.map(section => <NavLink key={section.to} to={section.to} end={section.end} className="settings-nav-link">
          <span className="settings-nav-icon" aria-hidden="true"><section.icon size={19} weight="bold" /></span>
          <span className="settings-nav-text"><strong>{section.label}</strong><small aria-hidden="true">{section.hint}</small></span>
        </NavLink>)}
      </nav>
      <div className="settings-content"><Outlet /></div>
    </div>
  </div>;
}

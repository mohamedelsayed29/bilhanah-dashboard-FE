import { Outlet, useLocation } from 'react-router';
import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { Brand } from '../components/Brand';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LanguageToggle } from '../components/LanguageToggle';
import { SITE_URL } from '../lib/config';
import { useLanguage } from '../lib/language';
import { useRouteFocus } from '../lib/use-route-focus';

/** Sign-in, registration, email links and onboarding: brand panel beside a focused form. `admin` is the team's sign-in. */
export function AuthLayout({ wide = false, variant = 'owner' }: { wide?: boolean; variant?: 'owner' | 'admin' }) {
  const { text, number } = useLanguage();
  const { pathname } = useLocation();
  useRouteFocus();
  const admin = variant === 'admin';
  return <div className={`auth-shell ${wide ? 'auth-shell-wide' : ''} ${admin ? 'auth-shell-admin' : ''}`}>
    <a className="skip-link" href="#main-content">{text('انتقل للمحتوى', 'Skip to content')}</a>
    <aside className="auth-visual" aria-hidden="true">
      <img className="auth-photo" src="/media/auth-restaurant.jpg" alt="" width="1600" height="1066" />
      <div className="auth-visual-inner">
        <img className="auth-visual-logo" src="/brand/bilhanah-logo-light.svg" alt="" width="1507" height="479" />
        {admin ? <div className="auth-visual-copy">
          <span className="admin-pill"><ShieldCheckIcon size={16} weight="fill" />{text('لوحة الإدارة', 'Admin console')}</span>
          <p className="auth-visual-title">{text('مساحة فريق بالهنا.', 'For the Bilhanah team.')}</p>
          <ul>
            <li><CheckIcon size={18} weight="bold" />{text('راجع التحويلات وفعّل الاشتراكات', 'Review transfers and activate plans')}</li>
            <li><CheckIcon size={18} weight="bold" />{text('تابع المطاعم وفترات الاشتراك', 'Follow restaurants and their periods')}</li>
            <li><CheckIcon size={18} weight="bold" />{text('كل تغيير بيتسجل في سجل المراجعة', 'Every change goes to the audit log')}</li>
          </ul>
        </div> : <div className="auth-visual-copy">
          <p className="auth-visual-title">{text('منيو مطعمك، في إيدك.', 'Your restaurant menu, in your hands.')}</p>
          <ul>
            <li><CheckIcon size={18} weight="bold" />{text('عدّل الأصناف والأسعار في ثواني', 'Update dishes and prices in seconds')}</li>
            <li><CheckIcon size={18} weight="bold" />{text('علّم الصنف إنه خلص بلمسة واحدة', 'Mark items sold out with one tap')}</li>
            <li><CheckIcon size={18} weight="bold" />{text('QR جاهز للطباعة باسم مطعمك', 'A print-ready QR with your name on it')}</li>
          </ul>
        </div>}
      </div>
    </aside>
    <div className="auth-main">
      <header className="auth-header">
        <div className="auth-header-start">
          <a href={SITE_URL} className="auth-back"><ArrowRightIcon size={16} weight="bold" className="directional" aria-hidden="true" /><span className="auth-back-label">{text('الرئيسية', 'Home')}</span></a>
          <Brand to={admin ? '/admin/login' : wide ? '/onboarding' : '/login'} />
        </div>
        <LanguageToggle />
      </header>
      <main id="main-content" tabIndex={-1} className="auth-content">
        <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
      </main>
      <footer className="auth-footer">
        <span>© {number(new Date().getFullYear(), { useGrouping: false })} {text('بالهنا', 'Bilhanah')}</span>
        <a href={SITE_URL} className="link-muted">{text('الموقع الرئيسي', 'Website')}</a>
      </footer>
    </div>
  </div>;
}

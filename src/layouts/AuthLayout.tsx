import { Outlet, useLocation } from 'react-router';
import { CheckIcon } from '@phosphor-icons/react';
import { Brand } from '../components/Brand';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LanguageToggle } from '../components/LanguageToggle';
import { useLanguage } from '../lib/language';
import { useRouteFocus } from '../lib/use-route-focus';

/** Sign-in, registration, email links and onboarding: brand panel beside a focused form. */
export function AuthLayout({ wide = false }: { wide?: boolean }) {
  const { text } = useLanguage();
  const { pathname } = useLocation();
  useRouteFocus();
  return <div className={`auth-shell ${wide ? 'auth-shell-wide' : ''}`}>
    <a className="skip-link" href="#main-content">{text('انتقل للمحتوى', 'Skip to content')}</a>
    <aside className="auth-visual" aria-hidden="true">
      <img className="auth-photo" src="/media/auth-food.jpg" alt="" width="1280" height="720" />
      <div className="auth-visual-inner">
        <img className="auth-visual-logo" src="/brand/bilhanah-logo-light.svg" alt="" width="1507" height="479" />
        <div className="auth-visual-copy">
          <p className="auth-visual-title">{text('منيو مطعمك، في إيدك.', 'Your restaurant menu, in your hands.')}</p>
          <ul>
            <li><CheckIcon size={18} weight="bold" />{text('عدّل الأصناف والأسعار في ثواني', 'Update dishes and prices in seconds')}</li>
            <li><CheckIcon size={18} weight="bold" />{text('علّم الصنف إنه خلص بلمسة واحدة', 'Mark items sold out with one tap')}</li>
            <li><CheckIcon size={18} weight="bold" />{text('QR جاهز للطباعة باسم مطعمك', 'A print-ready QR with your name on it')}</li>
          </ul>
        </div>
      </div>
    </aside>
    <div className="auth-main">
      <header className="auth-header">
        <Brand to={wide ? '/onboarding' : '/login'} />
        <LanguageToggle />
      </header>
      <main id="main-content" tabIndex={-1} className="auth-content">
        <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
      </main>
      <footer className="auth-footer">
        <span>© {new Date().getFullYear()} {text('بالهنا', 'Bilhanah')}</span>
        <a href="https://bilhanah.com" className="link-muted">{text('الموقع الرئيسي', 'Website')}</a>
      </footer>
    </div>
  </div>;
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { authApi } from '../../lib/api/endpoints';
import { useLanguage, usePageTitle } from '../../lib/language';
import { sessionStore } from '../../lib/session';
import { AuthCard } from './AuthCard';

let signingOut: Promise<void> | null = null;

export function LogoutPage() {
  const { text } = useLanguage();
  usePageTitle('تسجيل الخروج', 'Signing out');
  const navigate = useNavigate();
  // Administrators return to their own sign-in page.
  const [login] = useState(() => {
    const state = sessionStore.getState();
    return state.status === 'authenticated' && state.user.role === 'ADMIN' ? '/admin/login' : '/login';
  });
  useEffect(() => {
    signingOut ??= authApi.logout().finally(() => { signingOut = null; });
    let active = true;
    void signingOut.then(() => { if (active) navigate(login, { replace: true, state: { signedOut: true } }); });
    return () => { active = false; };
  }, [navigate, login]);
  return <AuthCard icon={<span className="spinner" />} title={text('بنخرّجك من حسابك…', 'Signing you out…')} />;
}

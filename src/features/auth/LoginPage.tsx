import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { AUTH_ERROR_CODES, loginSchema } from '@bilhanah/contracts';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { PasswordInput } from '../../components/PasswordInput';
import { isApiError } from '../../lib/api';
import { authApi } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/error-messages';
import { schemaResolver } from '../../lib/forms';
import { useLanguage, usePageTitle } from '../../lib/language';
import { AuthCard } from './AuthCard';

type Notice = { expired?: boolean; signedOut?: boolean; passwordReset?: boolean } | null;

export function LoginPage() {
  const { text } = useLanguage();
  usePageTitle('تسجيل الدخول', 'Sign in');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const notice = useLocation().state as Notice;
  const [error, setError] = useState<unknown>(null);
  const [resending, setResending] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm({
    resolver: schemaResolver(loginSchema),
    defaultValues: { email: params.get('email') ?? '', password: '' },
  });

  // Success needs no navigation here: RequireGuest sends the signed-in owner on.
  const onSubmit = handleSubmit(async values => {
    setError(null);
    try { await authApi.login(values); } catch (caught) { setError(caught); }
  });

  const resend = async () => {
    const email = getValues('email').trim().toLowerCase();
    setResending(true);
    try {
      await authApi.resendVerification(email);
      navigate('/check-email', { state: { email } });
    } catch (caught) {
      setError(caught);
    } finally {
      setResending(false);
    }
  };

  const unverified = isApiError(error, AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED);
  return <AuthCard title={text('أهلًا بيك تاني', 'Welcome back')} description={text('سجّل دخولك عشان تدير منيو مطعمك.', 'Sign in to manage your restaurant menu.')}>
    {notice?.expired && !error && <Alert kind="info">{text('انتهت جلستك. سجّل دخولك تاني.', 'Your session has ended. Please sign in again.')}</Alert>}
    {notice?.signedOut && !error && <Alert kind="success">{text('خرجت من حسابك.', 'You have signed out.')}</Alert>}
    {notice?.passwordReset && !error && <Alert kind="success">{text('اتغيرت كلمة السر. سجّل دخولك بالكلمة الجديدة.', 'Your password was changed. Sign in with the new one.')}</Alert>}
    {error !== null && (unverified
      ? <Alert kind="warning" title={text('إيميلك لسه متأكدش', 'Your email is not confirmed yet')}
          actions={<Button small variant="secondary" loading={resending} onClick={resend}>{text('ابعت رسالة التأكيد تاني', 'Resend confirmation email')}</Button>}>
          {text('افتح رسالة التأكيد اللي بعتناها لإيميلك، أو اطلب رسالة جديدة.', 'Open the confirmation message we emailed you, or ask for a new one.')}
        </Alert>
      : <Alert kind="error">{errorMessage(error, text)}</Alert>)}
    <form className="form" onSubmit={onSubmit} noValidate>
      <Field label={text('الإيميل', 'Email')} error={errors.email} required>
        <input className="input" type="email" autoComplete="email" inputMode="email" dir="ltr" {...register('email')} />
      </Field>
      <Field label={text('كلمة السر', 'Password')} error={errors.password} required>
        <PasswordInput autoComplete="current-password" {...register('password')} />
      </Field>
      <div className="auth-row">
        <Link className="link" to="/forgot-password">{text('نسيت كلمة السر؟', 'Forgot your password?')}</Link>
      </div>
      <Button type="submit" block loading={isSubmitting}>{text('دخول', 'Sign in')}</Button>
    </form>
    <p className="auth-alt">{text('لسه معندكش حساب؟', 'New to Bilhanah?')} <Link className="link" to="/register">{text('ابدأ تجربتك المجانية', 'Start your free trial')}</Link></p>
  </AuthCard>;
}

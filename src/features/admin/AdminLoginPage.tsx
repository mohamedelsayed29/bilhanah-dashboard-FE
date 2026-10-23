import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useForm } from 'react-hook-form';
import { ShieldCheckIcon } from '@phosphor-icons/react';
import { ADMIN_ERROR_CODES, adminLoginSchema, AUTH_ERROR_CODES } from '@bilhanah/contracts';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { PasswordInput } from '../../components/PasswordInput';
import { isApiError } from '../../lib/api';
import { authApi } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/error-messages';
import { normalizeDigits } from '../../lib/format';
import { schemaResolver } from '../../lib/forms';
import { useLanguage, usePageTitle } from '../../lib/language';
import { AuthCard } from '../auth/AuthCard';

/** Administrators: email, password and the 6-digit code from their authenticator app. */
export function AdminLoginPage() {
  const { text } = useLanguage();
  usePageTitle('دخول فريق بالهنا', 'Team sign-in');
  const notice = useLocation().state as { expired?: boolean; signedOut?: boolean } | null;
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, setValue, setFocus, formState: { errors, isSubmitting } } = useForm({
    resolver: schemaResolver(adminLoginSchema),
    defaultValues: { email: '', password: '', code: '' },
  });

  // Success needs no navigation: RequireGuest sends the administrator to the console.
  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      await authApi.adminLogin(values);
    } catch (caught) {
      setError(caught);
      // A code works once; the next attempt needs a fresh one.
      setValue('code', '');
      setFocus(isApiError(caught, AUTH_ERROR_CODES.INVALID_CREDENTIALS) ? 'code' : 'email');
    }
  });

  const message = isApiError(error, AUTH_ERROR_CODES.INVALID_CREDENTIALS)
    // Never say which of the three was wrong.
    ? text('الإيميل أو كلمة السر أو الكود مش صح.', 'The email, password or code is incorrect.')
    : errorMessage(error, text);
  const code = register('code', { setValueAs: (value: string) => normalizeDigits(value).replace(/\D/g, '') });
  return <AuthCard icon={<ShieldCheckIcon size={28} weight="duotone" />} title={text('دخول فريق بالهنا', 'Bilhanah team sign-in')}
    description={text('للمسؤولين بس. هتحتاج الكود اللي فيه ٦ أرقام من تطبيق المصادقة.', 'Administrators only. You will need the 6-digit code from your authenticator app.')}>
    {notice?.expired && !error && <Alert kind="info">{text('انتهت جلستك. سجّل دخولك تاني.', 'Your session has ended. Please sign in again.')}</Alert>}
    {notice?.signedOut && !error && <Alert kind="success">{text('خرجت من حسابك.', 'You have signed out.')}</Alert>}
    {error !== null && (isApiError(error, ADMIN_ERROR_CODES.MFA_NOT_SET_UP)
      ? <Alert kind="warning" title={text('التحقق بخطوتين مش متفعّل', 'Two-step sign-in is not set up')}>
          {text('الحساب ده محتاج مفتاح مصادقة جديد. اطلب من المسؤول التقني يشغّل:', 'This account needs a new authenticator key. Ask an operator to run:')}
          <code className="command ltr">npm run admin:reset-mfa -- --email &lt;email&gt;</code>
        </Alert>
      : <Alert kind="error">{message}</Alert>)}
    <form className="form" onSubmit={onSubmit} noValidate>
      <Field label={text('الإيميل', 'Email')} error={errors.email} required>
        <input className="input" type="email" autoComplete="username" inputMode="email" dir="ltr" {...register('email')} />
      </Field>
      <Field label={text('كلمة السر', 'Password')} error={errors.password} required>
        <PasswordInput autoComplete="current-password" {...register('password')} />
      </Field>
      <Field label={text('كود التحقق', 'Authentication code')} error={errors.code} required hint={text('الكود بيتغير كل ٣٠ ثانية.', 'The code changes every 30 seconds.')}>
        <input className="input otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} dir="ltr" placeholder="123456" {...code} />
      </Field>
      <Button type="submit" block loading={isSubmitting}>{text('دخول', 'Sign in')}</Button>
    </form>
    <p className="auth-alt">{text('صاحب مطعم؟', 'Restaurant owner?')} <Link className="link" to="/login">{text('ادخل من هنا', 'Sign in here')}</Link></p>
  </AuthCard>;
}

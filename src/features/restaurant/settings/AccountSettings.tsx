import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DesktopIcon, DeviceMobileIcon, SignOutIcon } from '@phosphor-icons/react';
import { AUTH_ERROR_CODES, type AuthSession, type Language, passwordSchema } from '@bilhanah/contracts';
import { z } from 'zod';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { Field } from '../../../components/Field';
import { PasswordInput } from '../../../components/PasswordInput';
import { Skeleton } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import { isApiError } from '../../../lib/api';
import { authApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { formatDate, formatRelative } from '../../../lib/format';
import { schemaResolver } from '../../../lib/forms';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { sessionStore, useSession } from '../../../lib/session';
import { queryKeys, useSessionsQuery } from '../queries';

const changePasswordFormSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema, confirm: z.string() })
  .refine(values => values.newPassword === values.confirm, { path: ['confirm'], message: '@@mismatch' });

/** "Chrome on Android" from a user agent; good enough to recognise one's own devices. */
export function describeDevice(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: '', mobile: false };
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /OPR\//.test(userAgent) ? 'Opera' : /SamsungBrowser/.test(userAgent) ? 'Samsung Internet'
    : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : null;
  const os = /Android/.test(userAgent) ? 'Android' : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS' : /Windows/.test(userAgent) ? 'Windows'
    : /Mac OS X/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : null;
  return { label: [browser, os].filter(Boolean).join(' · '), mobile: /Mobile|Android|iPhone|iPad/.test(userAgent) };
}

export function AccountSettings() {
  const { text } = useLanguage();
  usePageTitle('الحساب والأمان', 'Account and security');
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  return <div className="settings-grid">
    <div className="form">
      <ChangePassword />
      <Sessions />
    </div>
    <aside className="card card-padded" aria-labelledby="profile-title">
      <h2 id="profile-title" className="section-title">{text('حسابك', 'Your account')}</h2>
      <dl className="details">
        <div><dt>{text('الاسم', 'Name')}</dt><dd>{user?.fullName}</dd></div>
        <div><dt>{text('الإيميل', 'Email')}</dt><dd className="ltr">{user?.email}</dd></div>
      </dl>
      {user && <EmailLanguage current={user.preferredLanguage} />}
      <Link to="/logout" className="button button-secondary button-block"><SignOutIcon size={18} className="directional" aria-hidden="true" />{text('خروج من الجهاز ده', 'Sign out of this device')}</Link>
    </aside>
  </div>;
}

/** The language of the emails Bilhanah sends (confirmations, password resets). */
function EmailLanguage({ current }: { current: Language }) {
  const { text, hasPreference } = useLanguage();
  const toast = useToast();
  const save = useMutation({
    mutationFn: (preferredLanguage: Language) => authApi.updateProfile({ preferredLanguage }),
    onSuccess: user => {
      sessionStore.updateUser(user);
      // Without a chosen display language the dashboard follows this setting, so confirm in the new language.
      const confirm = hasPreference ? text : (ar: string, en: string) => (user.preferredLanguage === 'ar' ? ar : en);
      toast.success(confirm('اتحفظت لغة الرسائل', 'Email language saved'));
    },
    onError: error => toast.error(errorMessage(error, text)),
  });
  return <Field label={text('لغة الرسائل', 'Email language')} hint={text('لغة إيميلات التفعيل واستعادة كلمة السر.', 'Used for confirmation and password emails.')}>
    <select className="select" value={current} disabled={save.isPending} onChange={event => save.mutate(event.target.value as Language)}>
      <option value="ar">العربية</option>
      <option value="en">English</option>
    </select>
  </Field>;
}

function ChangePassword() {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, reset, setError: setFieldError, formState: { errors, isSubmitting } } = useForm({
    resolver: schemaResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setError(null);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      reset();
      toast.success(text('اتغيرت كلمة السر، وخرّجنا أي جهاز تاني من حسابك.', 'Password changed. Any other devices were signed out.'));
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    } catch (caught) {
      if (isApiError(caught, AUTH_ERROR_CODES.INVALID_CREDENTIALS)) {
        setFieldError('currentPassword', { type: 'server', message: text('كلمة السر الحالية مش صح.', 'Your current password is incorrect.') }, { shouldFocus: true });
      } else {
        setError(caught);
      }
    }
  });
  return <section className="card card-padded" aria-labelledby="password-title">
    <div className="card-header"><div>
      <h2 id="password-title">{text('تغيير كلمة السر', 'Change password')}</h2>
      <p>{text('بعد التغيير هنخرّج أي جهاز تاني من حسابك.', 'After the change, every other device is signed out.')}</p>
    </div></div>
    <form className="form" onSubmit={onSubmit} noValidate>
      {error !== null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
      <Field label={text('كلمة السر الحالية', 'Current password')} error={errors.currentPassword} required>
        <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
      </Field>
      <div className="form-grid">
        <Field label={text('كلمة السر الجديدة', 'New password')} error={errors.newPassword} required hint={text('٨ حروف على الأقل.', 'At least 8 characters.')}>
          <PasswordInput autoComplete="new-password" {...register('newPassword')} />
        </Field>
        <Field label={text('اكتبها تاني', 'Confirm new password')} error={errors.confirm} required>
          <PasswordInput autoComplete="new-password" {...register('confirm')} />
        </Field>
      </div>
      <div className="form-actions"><Button type="submit" loading={isSubmitting}>{text('غيّر كلمة السر', 'Change password')}</Button></div>
    </form>
  </section>;
}

function Sessions() {
  const { text } = useLanguage();
  const sessions = useSessionsQuery();
  return <section className="card card-padded" aria-labelledby="sessions-title">
    <div className="card-header"><div>
      <h2 id="sessions-title">{text('الأجهزة المسجّل دخولها', 'Signed-in devices')}</h2>
      <p>{text('لو شايف جهاز مش بتاعك، خرّجه وغيّر كلمة السر.', 'If you don’t recognise a device, sign it out and change your password.')}</p>
    </div></div>
    {sessions.isPending && <div className="skeleton-stack"><Skeleton height={56} /><Skeleton height={56} /></div>}
    {sessions.isError && <ErrorPanel error={sessions.error} onRetry={() => void sessions.refetch()} />}
    {sessions.data && <ul className="session-list">
      {[...sessions.data].sort((a, b) => Number(b.current) - Number(a.current)).map(entry => <SessionRow key={entry.id} session={entry} />)}
    </ul>}
  </section>;
}

function SessionRow({ session }: { session: AuthSession }) {
  const { text, language } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const device = describeDevice(session.userAgent);
  const revoke = useMutation({
    mutationFn: () => authApi.revokeSession(session.id),
    onSuccess: () => {
      queryClient.setQueryData<AuthSession[]>(queryKeys.sessions, list => list?.filter(entry => entry.id !== session.id));
      toast.success(text('خرّجنا الجهاز ده', 'Device signed out'));
    },
    onError: error => toast.error(errorMessage(error, text)),
  });
  const Icon = device.mobile ? DeviceMobileIcon : DesktopIcon;
  const name = device.label || text('جهاز غير معروف', 'Unknown device');
  return <li className="session-row" data-testid="session-row">
    <span className="session-icon" aria-hidden="true"><Icon size={22} /></span>
    <div className="session-info">
      <strong>{name} {session.current && <span className="badge badge-success">{text('الجهاز ده', 'This device')}</span>}</strong>
      <small>
        {session.lastUsedAt ? text(`آخر استخدام ${formatRelative(session.lastUsedAt, language)}`, `Active ${formatRelative(session.lastUsedAt, language)}`) : text(`دخل ${formatDate(session.createdAt, language)}`, `Signed in ${formatDate(session.createdAt, language)}`)}
        {session.ipAddress && <> · <span className="ltr">{session.ipAddress}</span></>}
      </small>
    </div>
    {session.current
      ? <Link to="/logout" className="button button-ghost button-small">{text('خروج', 'Sign out')}</Link>
      : <Button variant="danger-outline" small loading={revoke.isPending} onClick={() => revoke.mutate()} aria-label={text(`خرّج ${name}`, `Sign out ${name}`)}>{text('خرّجه', 'Sign out')}</Button>}
  </li>;
}

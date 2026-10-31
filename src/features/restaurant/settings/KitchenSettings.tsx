import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CookingPotIcon, PlusIcon } from '@phosphor-icons/react';
import { createKitchenAccountSchema, KITCHEN_ERROR_CODES, KITCHEN_LIMITS, type KitchenAccount, passwordSchema } from '@bilhanah/contracts';
import { z } from 'zod';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Dialog } from '../../../components/Dialog';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { Field } from '../../../components/Field';
import { PasswordInput } from '../../../components/PasswordInput';
import { Section } from '../../../components/Section';
import { Skeleton } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import { isApiError } from '../../../lib/api';
import { kitchenAccountsApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { formatRelative } from '../../../lib/format';
import { schemaResolver } from '../../../lib/forms';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { queryKeys } from '../queries';

const setPasswordFormSchema = z.object({ password: passwordSchema, confirm: z.string() })
  .refine(values => values.password === values.confirm, { path: ['confirm'], message: '@@mismatch' });

const replaceAccount = (list: KitchenAccount[] | undefined, account: KitchenAccount) => list?.map(entry => (entry.id === account.id ? account : entry));

/** Kitchen accounts: sign-ins for the kitchen's screens, which see and move orders and nothing else. */
export function KitchenSettings() {
  const { text } = useLanguage();
  usePageTitle('حسابات المطبخ', 'Kitchen accounts');
  const accounts = useQuery({ queryKey: queryKeys.kitchenAccounts, queryFn: kitchenAccountsApi.list });
  const [adding, setAdding] = useState(false);
  const full = (accounts.data?.length ?? 0) >= KITCHEN_LIMITS.accounts;
  return <div className="settings-grid">
    <div className="settings-main">
      <Section id="kitchen-title" title={text('حسابات المطبخ', 'Kitchen accounts')}
        description={text('اعمل حساب لكل شاشة أو تابلت في المطبخ. الحساب ده بيشوف الطلبات ويحرّكها بس، من غير أسعار ولا إعدادات.',
          'Create an account for each kitchen screen or tablet. It sees and moves orders only, without prices or settings.')}
        actions={<Button small onClick={() => setAdding(true)} disabled={full || !accounts.data} icon={<PlusIcon size={16} weight="bold" aria-hidden="true" />}>{text('حساب جديد', 'New account')}</Button>}>
        {accounts.isPending && <div className="skeleton-stack"><Skeleton height={56} /><Skeleton height={56} /></div>}
        {accounts.isError && <ErrorPanel error={accounts.error} onRetry={() => void accounts.refetch()} />}
        {accounts.data?.length === 0 && <p className="board-empty">{text('لسه مفيش حسابات مطبخ.', 'No kitchen accounts yet.')}</p>}
        {accounts.data && accounts.data.length > 0 && <ul className="session-list">
          {accounts.data.map(account => <KitchenAccountRow key={account.id} account={account} />)}
        </ul>}
        {full && <p className="field-hint">{text(`وصلت للحد الأقصى (${KITCHEN_LIMITS.accounts} حسابات).`, `You have reached the limit of ${KITCHEN_LIMITS.accounts} accounts.`)}</p>}
      </Section>
    </div>
    <aside className="settings-aside" aria-labelledby="kitchen-how-title">
      <h2 id="kitchen-how-title">{text('إزاي المطبخ يدخل؟', 'How the kitchen signs in')}</h2>
      <p className="field-hint">{text('على شاشة المطبخ افتح صفحة الدخول العادية، واكتب الإيميل وكلمة السر اللي عملتهم هنا. هتفتح شاشة الطلبات على طول، وبترن مع كل طلب جديد.',
        'On the kitchen screen, open the usual sign-in page and enter the email and password you set here. It opens straight to the live orders and rings for each new one.')}</p>
    </aside>
    <AddKitchenAccountDialog open={adding} onClose={() => setAdding(false)} />
  </div>;
}

function KitchenAccountRow({ account }: { account: KitchenAccount }) {
  const { text, language } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [settingPassword, setSettingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toggle = useMutation({
    mutationFn: () => kitchenAccountsApi.update(account.id, { active: !account.active }),
    onSuccess: saved => {
      queryClient.setQueryData<KitchenAccount[]>(queryKeys.kitchenAccounts, list => replaceAccount(list, saved));
      toast.success(saved.active ? text('رجّعنا الحساب يشتغل', 'Account turned back on') : text('وقّفنا الحساب وخرّجنا شاشاته', 'Account turned off and its screens signed out'));
    },
    onError: error => toast.error(errorMessage(error, text)),
  });
  const remove = useMutation({
    mutationFn: () => kitchenAccountsApi.remove(account.id),
    onSuccess: () => {
      queryClient.setQueryData<KitchenAccount[]>(queryKeys.kitchenAccounts, list => list?.filter(entry => entry.id !== account.id));
      toast.success(text('مسحنا الحساب', 'Account deleted'));
      setDeleting(false);
    },
    onError: error => toast.error(errorMessage(error, text)),
  });
  return <li className="session-row" data-testid="kitchen-account-row">
    <span className="session-icon" aria-hidden="true"><CookingPotIcon size={22} /></span>
    <div className="session-info">
      <strong><bdi>{account.fullName}</bdi> {!account.active && <span className="badge badge-danger">{text('موقوف', 'Off')}</span>}</strong>
      <small><span className="ltr">{account.email}</span>
        {' · '}{account.lastSeenAt ? text(`آخر استخدام ${formatRelative(account.lastSeenAt, language)}`, `Active ${formatRelative(account.lastSeenAt, language)}`) : text('لسه ما دخلش', 'Not signed in yet')}
      </small>
    </div>
    <div className="page-actions">
      <Button small variant="ghost" onClick={() => setSettingPassword(true)}>{text('كلمة سر جديدة', 'New password')}</Button>
      <Button small variant="secondary" loading={toggle.isPending} onClick={() => toggle.mutate()}>{account.active ? text('وقّفه', 'Turn off') : text('شغّله', 'Turn on')}</Button>
      <Button small variant="danger-outline" onClick={() => setDeleting(true)}>{text('امسح', 'Delete')}</Button>
    </div>
    <SetPasswordDialog account={settingPassword ? account : null} onClose={() => setSettingPassword(false)} />
    <ConfirmDialog open={deleting} busy={remove.isPending} onCancel={() => setDeleting(false)} onConfirm={() => remove.mutate()}
      title={text('تمسح حساب المطبخ؟', 'Delete this kitchen account?')} confirmLabel={text('امسح', 'Delete')}
      description={text(`أي شاشة داخلة بحساب «${account.fullName}» هتخرج على طول.`, `Any screen signed in as “${account.fullName}” is signed out at once.`)} />
  </li>;
}

function AddKitchenAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, reset, setError: setFieldError, formState: { errors, isSubmitting } } = useForm({
    resolver: schemaResolver(createKitchenAccountSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });
  useEffect(() => { if (open) { reset(); setError(null); } }, [open, reset]);
  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      const account = await kitchenAccountsApi.create(values);
      queryClient.setQueryData<KitchenAccount[]>(queryKeys.kitchenAccounts, list => [...(list ?? []), account]);
      toast.success(text(`عملنا حساب «${account.fullName}»`, `“${account.fullName}” created`));
      onClose();
    } catch (caught) {
      if (isApiError(caught, KITCHEN_ERROR_CODES.EMAIL_TAKEN)) setFieldError('email', { type: 'server', message: errorMessage(caught, text) }, { shouldFocus: true });
      else setError(caught);
    }
  });
  return <Dialog open={open} onClose={onClose} busy={isSubmitting} onSubmit={() => void onSubmit()} title={text('حساب مطبخ جديد', 'New kitchen account')}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>{text('إلغاء', 'Cancel')}</Button>
      <Button type="submit" loading={isSubmitting}>{text('اعمل الحساب', 'Create account')}</Button>
    </>}>
    <div className="form">
      {error !== null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
      <Field label={text('الاسم', 'Name')} error={errors.fullName} required hint={text('زي «مطبخ رئيسي» أو «شاشة المشويات».', 'For example “Main kitchen” or “Grill screen”.')}>
        <input className="input" data-autofocus maxLength={100} {...register('fullName')} />
      </Field>
      <Field label={text('الإيميل', 'Email')} error={errors.email} required hint={text('بيُستخدم للدخول بس، ومش هنبعت عليه رسايل.', 'Used to sign in only; we send nothing to it.')}>
        <input className="input ltr-input" dir="ltr" type="email" autoComplete="off" {...register('email')} />
      </Field>
      <Field label={text('كلمة السر', 'Password')} error={errors.password} required hint={text('٨ حروف على الأقل.', 'At least 8 characters.')}>
        <PasswordInput autoComplete="new-password" {...register('password')} />
      </Field>
    </div>
  </Dialog>;
}

function SetPasswordDialog({ account, onClose }: { account: KitchenAccount | null; onClose: () => void }) {
  const { text } = useLanguage();
  const toast = useToast();
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: schemaResolver(setPasswordFormSchema),
    defaultValues: { password: '', confirm: '' },
  });
  useEffect(() => { if (account) { reset(); setError(null); } }, [account, reset]);
  const onSubmit = handleSubmit(async ({ password }) => {
    if (!account) return;
    setError(null);
    try {
      await kitchenAccountsApi.setPassword(account.id, password);
      toast.success(text('اتغيرت كلمة السر، وخرّجنا الشاشات اللي كانت داخلة بالحساب.', 'Password changed; screens using the account were signed out.'));
      onClose();
    } catch (caught) {
      setError(caught);
    }
  });
  return <Dialog open={account !== null} onClose={onClose} size="small" busy={isSubmitting} onSubmit={() => void onSubmit()}
    title={text(`كلمة سر جديدة لـ «${account?.fullName ?? ''}»`, `New password for “${account?.fullName ?? ''}”`)}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>{text('إلغاء', 'Cancel')}</Button>
      <Button type="submit" loading={isSubmitting}>{text('احفظ', 'Save')}</Button>
    </>}>
    <div className="form">
      {error !== null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
      <Field label={text('كلمة السر الجديدة', 'New password')} error={errors.password} required hint={text('٨ حروف على الأقل.', 'At least 8 characters.')}>
        <PasswordInput data-autofocus autoComplete="new-password" {...register('password')} />
      </Field>
      <Field label={text('اكتبها تاني', 'Confirm password')} error={errors.confirm} required>
        <PasswordInput autoComplete="new-password" {...register('confirm')} />
      </Field>
    </div>
  </Dialog>;
}

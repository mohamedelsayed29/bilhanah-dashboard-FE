import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CookingPotIcon, PlusIcon, UserGearIcon } from '@phosphor-icons/react';
import { createKitchenAccountSchema, KITCHEN_ERROR_CODES, KITCHEN_LIMITS, type KitchenAccount, passwordSchema, STAFF_LIMITS, type StaffRole } from '@bilhanah/contracts';
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
import { fill, useCopy } from '../../../lib/copy';
import { formatRelative } from '../../../lib/format';
import { schemaResolver } from '../../../lib/forms';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useBranchScope } from '../../branches/BranchScope';
import { useBranchList } from '../../branches/workspace';
import { queryKeys } from '../queries';

const setPasswordFormSchema = z.object({ password: passwordSchema, confirm: z.string() })
  .refine(values => values.password === values.confirm, { path: ['confirm'], message: '@@mismatch' });
const editAccountSchema = z.object({ fullName: z.string().trim().min(2).max(100) });

const replaceAccount = (list: KitchenAccount[] | undefined, account: KitchenAccount) => list?.map(entry => (entry.id === account.id ? account : entry));

/** Team accounts: kitchen screens (see and move orders) and branch managers (run one branch, or every branch). */
export function KitchenSettings() {
  const { number } = useLanguage();
  const t = useCopy();
  usePageTitle('الفريق', 'Team');
  const accounts = useQuery({ queryKey: queryKeys.kitchenAccounts, queryFn: kitchenAccountsApi.list });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<KitchenAccount | null>(null);
  const full = (accounts.data?.length ?? 0) >= STAFF_LIMITS.accounts;
  return <div className="settings-grid">
    <div className="settings-main">
      <Section id="kitchen-title" title={t.team.title} description={t.team.description}
        actions={<Button small onClick={() => setAdding(true)} disabled={full || !accounts.data} icon={<PlusIcon size={16} weight="bold" aria-hidden="true" />}>{t.team.add}</Button>}>
        {accounts.isPending && <div className="skeleton-stack"><Skeleton height={56} /><Skeleton height={56} /></div>}
        {accounts.isError && <ErrorPanel error={accounts.error} onRetry={() => void accounts.refetch()} />}
        {accounts.data?.length === 0 && <p className="board-empty">{t.team.empty}</p>}
        {accounts.data && accounts.data.length > 0 && <ul className="session-list">
          {accounts.data.map(account => <KitchenAccountRow key={account.id} account={account} onEdit={() => setEditing(account)} />)}
        </ul>}
        <p className="field-hint">{fill(t.team.limits, { kitchens: number(KITCHEN_LIMITS.accounts), total: number(STAFF_LIMITS.accounts) })}</p>
      </Section>
    </div>
    <aside className="settings-aside" aria-labelledby="kitchen-how-title">
      <h2 id="kitchen-how-title">{t.team.howTitle}</h2>
      <p className="field-hint">{t.team.howBody}</p>
      <dl className="team-roles">
        <div><dt>{t.team.roleKitchen}</dt><dd>{t.team.roleKitchenHint}</dd></div>
        <div><dt>{t.team.roleManager}</dt><dd>{t.team.roleManagerHint}</dd></div>
      </dl>
    </aside>
    <AddKitchenAccountDialog open={adding} onClose={() => setAdding(false)} />
    <EditAccountDialog account={editing} onClose={() => setEditing(null)} />
  </div>;
}

/** The branches an account can work at: active ones, plus the account's own if it was archived. */
function useAccountBranches(current: string | null = null) {
  const list = useBranchList();
  return list.branches.filter(branch => branch.isActive || branch.id === current);
}

/** Role (kitchen screen or branch manager) and branch (one, or every branch) of a team account. */
function RoleAndBranch({ role, branchId, onRole, onBranch }: { role: StaffRole; branchId: string | null; onRole: (role: StaffRole) => void; onBranch: (branchId: string | null) => void }) {
  const t = useCopy();
  const branches = useAccountBranches(branchId);
  const roles: { value: StaffRole; label: string; hint: string }[] = [
    { value: 'KITCHEN', label: t.team.roleKitchen, hint: t.team.roleKitchenHint },
    { value: 'MANAGER', label: t.team.roleManager, hint: t.team.roleManagerHint },
  ];
  return <>
    <fieldset className="field">
      <legend className="field-label">{t.team.role}</legend>
      <div className="order-types role-options">
        {roles.map(option => <label key={option.value} className={`order-type ${role === option.value ? 'is-checked' : ''}`}>
          <input type="radio" name="staff-role" value={option.value} checked={role === option.value} onChange={() => onRole(option.value)} />
          <span><strong>{option.label}</strong><small>{option.hint}</small></span>
        </label>)}
      </div>
    </fieldset>
    {branches.length > 1 && <Field label={t.team.branch} hint={branchId ? t.team.branchHint : t.team.branchAllHint}>
      <select className="select" value={branchId ?? ''} onChange={event => onBranch(event.target.value || null)} data-testid="staff-branch">
        <option value="">{t.team.branchAll}</option>
        {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.isActive ? branch.name : `${branch.name} (${t.scope.archived})`}</option>)}
      </select>
    </Field>}
  </>;
}

function KitchenAccountRow({ account, onEdit }: { account: KitchenAccount; onEdit: () => void }) {
  const { text, language } = useLanguage();
  const t = useCopy();
  const toast = useToast();
  const queryClient = useQueryClient();
  const multi = useBranchList().branches.filter(branch => branch.isActive).length > 1;
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      toast.success(text('مسحنا الحساب', 'Account deleted'));
      setDeleting(false);
    },
    onError: error => toast.error(errorMessage(error, text)),
  });
  const manager = account.role === 'MANAGER';
  const RoleIcon = manager ? UserGearIcon : CookingPotIcon;
  return <li className="session-row" data-testid="kitchen-account-row">
    <span className="session-icon" aria-hidden="true"><RoleIcon size={22} /></span>
    <div className="session-info">
      <strong><bdi>{account.fullName}</bdi> <span className={`badge ${manager ? 'badge-guava' : 'badge-muted'}`}>{manager ? t.team.roleManager : t.team.roleKitchen}</span>
        {' '}{!account.active && <span className="badge badge-danger">{text('موقوف', 'Off')}</span>}</strong>
      <small>{multi && <><span data-testid="account-branch"><bdi>{account.branchName ?? t.team.allBranches}</bdi></span>{' · '}</>}<span className="ltr">{account.email}</span>
        {' · '}{account.lastSeenAt ? text(`آخر استخدام ${formatRelative(account.lastSeenAt, language)}`, `Active ${formatRelative(account.lastSeenAt, language)}`) : text('لسه ما دخلش', 'Not signed in yet')}
      </small>
    </div>
    <div className="page-actions">
      <Button small variant="ghost" onClick={onEdit}>{t.team.edit}</Button>
      <Button small variant="ghost" onClick={() => setSettingPassword(true)}>{text('كلمة سر جديدة', 'New password')}</Button>
      <Button small variant="secondary" loading={toggle.isPending} onClick={() => toggle.mutate()}>{account.active ? text('وقّفه', 'Turn off') : text('شغّله', 'Turn on')}</Button>
      <Button small variant="danger-outline" onClick={() => setDeleting(true)}>{text('امسح', 'Delete')}</Button>
    </div>
    <SetPasswordDialog account={settingPassword ? account : null} onClose={() => setSettingPassword(false)} />
    <ConfirmDialog open={deleting} busy={remove.isPending} onCancel={() => setDeleting(false)} onConfirm={() => remove.mutate()}
      title={text('تمسح الحساب ده؟', 'Delete this account?')} confirmLabel={text('امسح', 'Delete')}
      description={text(`أي جهاز داخل بحساب «${account.fullName}» هيخرج على طول.`, `Any device signed in as “${account.fullName}” is signed out at once.`)} />
  </li>;
}

function AddKitchenAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { text } = useLanguage();
  const t = useCopy();
  const toast = useToast();
  const queryClient = useQueryClient();
  const scope = useBranchScope();
  const [error, setError] = useState<unknown>(null);
  const [role, setRole] = useState<StaffRole>('KITCHEN');
  const [branchId, setBranchId] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError: setFieldError, formState: { errors, isSubmitting } } = useForm({
    resolver: schemaResolver(createKitchenAccountSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });
  useEffect(() => {
    if (!open) return;
    reset(); setError(null); setRole('KITCHEN');
    // A new account starts at the branch being worked on.
    setBranchId(scope.selected === 'all' ? null : scope.selected);
  }, [open, reset, scope.selected]);
  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      const account = await kitchenAccountsApi.create({ ...values, role, branchId });
      queryClient.setQueryData<KitchenAccount[]>(queryKeys.kitchenAccounts, list => [...(list ?? []), account]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      toast.success(text(`عملنا حساب «${account.fullName}»`, `“${account.fullName}” created`));
      onClose();
    } catch (caught) {
      if (isApiError(caught, KITCHEN_ERROR_CODES.EMAIL_TAKEN)) setFieldError('email', { type: 'server', message: errorMessage(caught, text) }, { shouldFocus: true });
      else setError(caught);
    }
  });
  return <Dialog open={open} onClose={onClose} busy={isSubmitting} onSubmit={() => void onSubmit()} title={t.team.newTitle}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>{text('إلغاء', 'Cancel')}</Button>
      <Button type="submit" loading={isSubmitting}>{text('اعمل الحساب', 'Create account')}</Button>
    </>}>
    <div className="form">
      {error !== null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
      <Field label={text('الاسم', 'Name')} error={errors.fullName} required hint={t.team.nameHint}>
        <input className="input" data-autofocus maxLength={100} {...register('fullName')} />
      </Field>
      <RoleAndBranch role={role} branchId={branchId} onRole={setRole} onBranch={setBranchId} />
      <Field label={text('الإيميل', 'Email')} error={errors.email} required hint={text('بيُستخدم للدخول بس، ومش هنبعت عليه رسايل.', 'Used to sign in only; we send nothing to it.')}>
        <input className="input ltr-input" dir="ltr" type="email" autoComplete="off" {...register('email')} />
      </Field>
      <Field label={text('كلمة السر', 'Password')} error={errors.password} required hint={text('٨ حروف على الأقل.', 'At least 8 characters.')}>
        <PasswordInput autoComplete="new-password" {...register('password')} />
      </Field>
    </div>
  </Dialog>;
}

/** Name, role and branch of an existing account; changing the role or branch signs its devices out. */
function EditAccountDialog({ account, onClose }: { account: KitchenAccount | null; onClose: () => void }) {
  const { text } = useLanguage();
  const t = useCopy();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [role, setRole] = useState<StaffRole>('KITCHEN');
  const [branchId, setBranchId] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: schemaResolver(editAccountSchema),
    defaultValues: { fullName: '' },
  });
  useEffect(() => {
    if (!account) return;
    reset({ fullName: account.fullName }); setError(null); setRole(account.role); setBranchId(account.branchId);
  }, [account, reset]);
  const movesSession = account !== null && (role !== account.role || branchId !== account.branchId);
  const onSubmit = handleSubmit(async ({ fullName }) => {
    if (!account) return;
    setError(null);
    const body = {
      ...(fullName !== account.fullName && { fullName }),
      ...(role !== account.role && { role }),
      ...(branchId !== account.branchId && { branchId }),
    };
    if (Object.keys(body).length === 0) { onClose(); return; }
    try {
      const saved = await kitchenAccountsApi.update(account.id, body);
      queryClient.setQueryData<KitchenAccount[]>(queryKeys.kitchenAccounts, list => replaceAccount(list, saved));
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      toast.success(movesSession ? t.team.savedSignedOut : t.team.saved);
      onClose();
    } catch (caught) {
      setError(caught);
    }
  });
  return <Dialog open={account !== null} onClose={onClose} busy={isSubmitting} onSubmit={() => void onSubmit()}
    title={fill(t.team.editTitle, { name: account?.fullName ?? '' })}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>{text('إلغاء', 'Cancel')}</Button>
      <Button type="submit" loading={isSubmitting}>{t.team.save}</Button>
    </>}>
    <div className="form">
      {error !== null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
      <Field label={text('الاسم', 'Name')} error={errors.fullName} required>
        <input className="input" data-autofocus maxLength={100} {...register('fullName')} />
      </Field>
      <RoleAndBranch role={role} branchId={branchId} onRole={setRole} onBranch={setBranchId} />
      <Alert kind={movesSession ? 'warning' : 'info'} live={movesSession}>{t.team.signOutWarning}</Alert>
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

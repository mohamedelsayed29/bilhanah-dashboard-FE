import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CashRegisterIcon, DesktopIcon, MagnifyingGlassIcon, PlugsConnectedIcon, StorefrontIcon, WarningCircleIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { POS_DEVICE_LIMITS, POS_MODE_LABELS, POS_MODES, POS_STATUS_LABELS, POS_STATUSES, type AdminPosRestaurant, type PosAccess, type PosMode, type PosStatus } from '@bilhanah/contracts';
import { Button } from '../../../components/Button';
import { Dialog } from '../../../components/Dialog';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Pagination } from '../../../components/Pagination';
import { Skeleton } from '../../../components/Skeleton';
import { Switch } from '../../../components/Switch';
import { useToast } from '../../../components/Toast';
import { adminPosApi } from '../../../lib/api/endpoints';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { formatDate } from '../../../lib/format';
import './pos.css';

const PLANS = [['MENU', 'المنيو', 'Menu'], ['ORDERS', 'منيو وطلبات', 'Menu & orders'], ['ADVANCED', 'التجربة الكاملة', 'Full experience']] as const;
const STATUS_TONES: Record<PosStatus, string> = { ACTIVE: 'is-active', PENDING_SETUP: 'is-pending', NOT_ACTIVATED: 'is-idle', SUSPENDED: 'is-suspended', DISABLED: 'is-disabled' };
const REASONS: Record<string, [string, string]> = { PLATFORM: ['مقفول للمنصة', 'Off platform-wide'], PLAN: ['مش في الباقة', 'Not in plan'], ADMIN: ['مقفول للمطعم', 'Off for restaurant'] };

/** POS for administrators (docs/POS.md): the platform switch and plans, and each restaurant's access. */
export function AdminPosPage() {
  const { text } = useLanguage();
  usePageTitle('الكاشير (POS)', 'Point of sale');
  return <div className="page admin-pos">
    <PageHeader title={text('الكاشير (POS)', 'Point of sale')} description={text('شغّل الكاشير للمنصة وحدد الباقات، وتحكّم في كل مطعم من غير ما يكلم الدعم.', 'Turn the POS on for the platform and its plans, and control each restaurant without them contacting support.')} />
    <Health />
    <PlatformCard />
    <Restaurants />
    <PosAudit />
  </div>;
}

function PlatformCard() {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['admin', 'pos', 'settings'], queryFn: adminPosApi.settings });
  const [enabled, setEnabled] = useState(false);
  const [plans, setPlans] = useState<('MENU' | 'ORDERS' | 'ADVANCED')[]>([]);
  useEffect(() => { if (settings.data) { setEnabled(settings.data.enabled); setPlans(settings.data.plans); } }, [settings.data]);
  const save = useMutation({
    mutationFn: () => adminPosApi.saveSettings({ enabled, plans }),
    onSuccess: next => { queryClient.setQueryData(['admin', 'pos', 'settings'], next); void queryClient.invalidateQueries({ queryKey: ['admin', 'pos'] }); toast.success(text('اتحفظ', 'Saved')); },
    onError: () => toast.error(text('مقدرناش نحفظ. جرّب تاني.', 'Could not save. Try again.')),
  });
  if (settings.isError) return <ErrorPanel error={settings.error} onRetry={() => void settings.refetch()} />;
  if (!settings.data) return <Skeleton height={180} />;
  const dirty = enabled !== settings.data.enabled || [...plans].sort().join() !== [...settings.data.plans].sort().join();
  const togglePlan = (code: 'MENU' | 'ORDERS' | 'ADVANCED', on: boolean) => setPlans(current => (on ? [...new Set([...current, code])] : current.filter(entry => entry !== code)));
  return <section className="ad-card admin-pos-platform" aria-labelledby="pos-platform">
    <header className="ad-card-head">
      <div className="admin-pos-title"><span className="ad-icon tone-coral" aria-hidden="true"><CashRegisterIcon size={20} weight="bold" /></span>
        <div><h2 id="pos-platform">{text('على مستوى المنصة', 'Platform-wide')}</h2><p className="muted">{text('لو مقفول، الكاشير مش متاح لأي مطعم.', 'When off, no restaurant can use the POS.')}</p></div></div>
      <span className={`admin-pos-state ${enabled ? 'is-on' : ''}`}>{enabled ? text('شغال', 'On') : text('مقفول', 'Off')}</span>
    </header>
    <div className="admin-pos-switches">
      <Switch checked={enabled} onChange={setEnabled} label={text('الكاشير متاح على بالهنا', 'The POS is offered on Bilhanah')} description={text('المطاعم اللي باقتها فيها الكاشير تقدر تفعّله بنفسها.', 'Restaurants whose plan includes it can turn it on themselves.')} />
    </div>
    <fieldset className="admin-pos-plans" disabled={!enabled}>
      <legend>{text('الباقات اللي فيها الكاشير', 'Plans that include the POS')}</legend>
      <div className="admin-pos-plan-list">{PLANS.map(([code, ar, en]) => <Switch key={code} checked={plans.includes(code)} onChange={on => togglePlan(code, on)} disabled={!enabled}
        label={text(ar, en)} description={plans.includes(code) ? text('مفعّل للباقة دي', 'Included in this plan') : text('مش ضمن الباقة', 'Not included')} />)}</div>
    </fieldset>
    {dirty && <div className="admin-pos-savebar"><span>{text('في تغييرات مش محفوظة', 'You have unsaved changes')}</span>
      <Button variant="secondary" onClick={() => { setEnabled(settings.data.enabled); setPlans(settings.data.plans); }}>{text('تراجع', 'Undo')}</Button>
      <Button loading={save.isPending} onClick={() => save.mutate()} data-testid="admin-pos-save">{text('احفظ', 'Save')}</Button></div>}
  </section>;
}

function Restaurants() {
  const { text, number } = useLanguage();
  const [status, setStatus] = useState<PosStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminPosRestaurant | null>(null);
  const params = { status: status || undefined, q: search.trim() || undefined, page, pageSize: 25 };
  const rows = useQuery({ queryKey: ['admin', 'pos', 'restaurants', params], queryFn: ({ signal }) => adminPosApi.restaurants(params, signal), placeholderData: keepPreviousData });
  return <section className="ad-card" aria-labelledby="pos-restaurants">
    <header className="ad-card-head"><div><h2 id="pos-restaurants">{text('المطاعم', 'Restaurants')}</h2><p className="muted">{rows.data ? text(`${number(rows.data.total)} مطعم`, `${rows.data.total} restaurants`) : ' '}</p></div></header>
    <div className="admin-pos-filters">
      <label className="search-box"><MagnifyingGlassIcon size={18} aria-hidden="true" /><input className="input" type="search" value={search} placeholder={text('دوّر بالاسم أو الدومين', 'Search name or subdomain')} aria-label={text('بحث', 'Search')} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
      <div className="filter-chips">{(['', ...POS_STATUSES] as const).map(value => <button key={value || 'all'} type="button" className={`filter-chip ${status === value ? 'active' : ''}`} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{value ? text(...POS_STATUS_LABELS[value]) : text('الكل', 'All')}</button>)}</div>
    </div>
    {rows.isError && <ErrorPanel error={rows.error} onRetry={() => void rows.refetch()} />}
    {rows.isPending && <Skeleton height={240} />}
    {rows.data && <div className="table-scroll"><table className="data-table">
      <thead><tr><th>{text('المطعم', 'Restaurant')}</th><th>{text('الحالة', 'Status')}</th><th>{text('النوع', 'Mode')}</th><th>{text('الأنواع المسموحة', 'Allowed modes')}</th><th>{text('الأجهزة', 'Devices')}</th><th><span className="visually-hidden">{text('تحكّم', 'Manage')}</span></th></tr></thead>
      <tbody>{rows.data.items.length === 0 ? <tr><td colSpan={6} className="muted">{text('مفيش مطاعم.', 'No restaurants.')}</td></tr> : rows.data.items.map(row => <tr key={row.id} data-testid="admin-pos-row">
        <td><Link to={`/admin/restaurants/${row.id}`}><strong>{row.name}</strong></Link><small className="muted ltr"> {row.subdomain}</small></td>
        <td><span className={`admin-pos-status ${STATUS_TONES[row.status]}`}>{text(...POS_STATUS_LABELS[row.status])}</span>{row.disabledReason && <small className="muted"> · {text(...REASONS[row.disabledReason]!)}</small>}{row.accessReason && <small className="muted"> · {row.accessReason}</small>}</td>
        <td>{row.mode ? text(...POS_MODE_LABELS[row.mode]) : '—'}</td>
        <td>{row.allowedModes.map(mode => text(...POS_MODE_LABELS[mode])).join('، ')}</td>
        <td className={row.devicesInUse >= row.maxDevices ? 'admin-pos-full' : undefined}><span className="ltr">{number(row.devicesInUse)} / {number(row.maxDevices)}</span></td>
        <td><Button small variant="secondary" onClick={() => setEditing(row)}>{text('تحكّم', 'Manage')}</Button></td>
      </tr>)}</tbody>
    </table></div>}
    {rows.data && <Pagination page={page} pageSize={25} total={rows.data.total} onChange={setPage} label={text('صفحات المطاعم', 'Restaurant pages')} />}
    {editing && <AccessDialog row={editing} onClose={() => setEditing(null)} />}
  </section>;
}

function AccessDialog({ row, onClose }: { row: AdminPosRestaurant; onClose: () => void }) {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [access, setAccess] = useState<PosAccess>(row.access);
  const [modes, setModes] = useState<PosMode[]>(row.allowedModes);
  const [reason, setReason] = useState(row.accessReason ?? '');
  const [maxDevices, setMaxDevices] = useState(String(row.maxDevices));
  const limit = Number(maxDevices);
  const limitValid = Number.isInteger(limit) && limit >= POS_DEVICE_LIMITS.min && limit <= POS_DEVICE_LIMITS.max;
  const save = useMutation({
    mutationFn: () => adminPosApi.setAccess(row.id, { access, allowedModes: modes, reason: access === 'ENABLED' ? null : reason.trim() || null, maxDevices: limit }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin', 'pos', 'restaurants'] }); toast.success(text('اتحفظ', 'Saved')); onClose(); },
    onError: () => toast.error(text('مقدرناش نحفظ. جرّب تاني.', 'Could not save. Try again.')),
  });
  const labels: Record<PosAccess, [string, string, string, string]> = {
    ENABLED: ['مسموح', 'Allowed', 'المطعم يقدر يفعّل الكاشير ويستخدمه.', 'The restaurant can activate and use the POS.'],
    SUSPENDED: ['موقوف مؤقتًا', 'Suspended', 'الإعدادات محفوظة، بس الكاشير متوقف لحد ما ترجّعه.', 'Settings are kept; the POS stops until you restore it.'],
    DISABLED: ['مقفول', 'Disabled', 'الكاشير مش متاح للمطعم ده.', 'The POS is not available to this restaurant.'],
  };
  return <Dialog open onClose={onClose} title={text(`الكاشير · ${row.name}`, `POS · ${row.name}`)} busy={save.isPending} onSubmit={() => { if (modes.length && limitValid) save.mutate(); }}
    footer={<><Button variant="secondary" onClick={onClose}>{text('إلغاء', 'Cancel')}</Button><Button type="submit" loading={save.isPending} disabled={!modes.length || !limitValid} data-testid="admin-pos-access-save">{text('احفظ', 'Save')}</Button></>}>
    <fieldset className="admin-pos-options"><legend className="field-label">{text('الوصول', 'Access')}</legend>
      {(['ENABLED', 'SUSPENDED', 'DISABLED'] as const).map(value => <label key={value} className={`admin-pos-option ${access === value ? 'is-checked' : ''}`}>
        <input type="radio" name="pos-access" checked={access === value} onChange={() => setAccess(value)} />
        <span><strong>{text(labels[value][0], labels[value][1])}</strong><small>{text(labels[value][2], labels[value][3])}</small></span>
      </label>)}
    </fieldset>
    {access !== 'ENABLED' && <label className="field"><span className="field-label">{text('السبب (بيظهر للمطعم)', 'Reason (shown to the restaurant)')}</span><input className="input" maxLength={300} value={reason} onChange={event => setReason(event.target.value)} /></label>}
    <fieldset className="admin-pos-options"><legend className="field-label">{text('الأنواع المسموحة', 'Allowed modes')}</legend>
      {POS_MODES.map(mode => <Switch key={mode} checked={modes.includes(mode)} label={text(...POS_MODE_LABELS[mode])}
        onChange={on => setModes(current => (on ? [...new Set([...current, mode])] : current.filter(entry => entry !== mode)))} />)}
      {!modes.length && <p className="field-error">{text('اختار نوع واحد على الأقل.', 'Choose at least one.')}</p>}
    </fieldset>
    <label className="field"><span className="field-label">{text('أقصى عدد أجهزة', 'Device limit')}</span>
      <input className="input ltr" dir="ltr" type="number" min={POS_DEVICE_LIMITS.min} max={POS_DEVICE_LIMITS.max} value={maxDevices} onChange={event => setMaxDevices(event.target.value)} data-testid="admin-pos-max-devices" />
      <small className="field-hint">{text(`مستخدم دلوقتي ${row.devicesInUse}. الأجهزة الموقوفة بتتحسب، والملغية لأ.`, `${row.devicesInUse} in use now. Paused devices count; revoked ones do not.`)}</small>
      {!limitValid && <small className="field-error">{text(`من ${POS_DEVICE_LIMITS.min} لـ ${POS_DEVICE_LIMITS.max}.`, `${POS_DEVICE_LIMITS.min} to ${POS_DEVICE_LIMITS.max}.`)}</small>}
    </label>
    <RestaurantDevices restaurantId={row.id} />
  </Dialog>;
}

/** A restaurant's registered devices: pause, resume or revoke any of them (each change is logged). */
function RestaurantDevices({ restaurantId }: { restaurantId: string }) {
  const { text, language } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const devices = useQuery({ queryKey: ['admin', 'pos', 'devices', restaurantId], queryFn: () => adminPosApi.devices(restaurantId) });
  const change = useMutation({
    mutationFn: ({ deviceId, status }: { deviceId: string; status: 'ACTIVE' | 'DISABLED' | 'REVOKED' }) => adminPosApi.deviceStatus(deviceId, { status }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin', 'pos'] }); toast.success(text('اتحفظ', 'Saved')); },
    onError: () => toast.error(text('مقدرناش نغيّر الجهاز.', 'Could not change the device.')),
  });
  const labels = { ACTIVE: text('شغال', 'Active'), DISABLED: text('موقوف', 'Paused'), REVOKED: text('ملغي', 'Revoked') } as const;
  return <section className="admin-pos-devices" aria-label={text('الأجهزة', 'Devices')}>
    <p className="field-label">{text('الأجهزة', 'Devices')}</p>
    {devices.isPending && <Skeleton height={60} />}
    {devices.isError && <ErrorPanel error={devices.error} onRetry={() => void devices.refetch()} />}
    {devices.data && (devices.data.length === 0 ? <p className="field-hint">{text('مفيش أجهزة متسجلة.', 'No registered devices.')}</p>
      : <ul>{devices.data.map(device => <li key={device.id} className={`is-${device.status.toLowerCase()}`}>
        <span><strong>{device.name}</strong><small>{device.branchName} · {labels[device.status]}{device.lastSeenAt ? ` · ${new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(device.lastSeenAt))}` : ''}</small></span>
        {device.status !== 'REVOKED' && <span className="admin-pos-device-actions">
          <Button small variant="secondary" loading={change.isPending && change.variables?.deviceId === device.id} onClick={() => change.mutate({ deviceId: device.id, status: device.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}>{device.status === 'ACTIVE' ? text('وقّف', 'Pause') : text('شغّل', 'Resume')}</Button>
          <Button small variant="danger-outline" onClick={() => change.mutate({ deviceId: device.id, status: 'REVOKED' })}>{text('ألغي', 'Revoke')}</Button>
        </span>}
      </li>)}</ul>)}
  </section>;
}

/** Across restaurants: who runs the POS, devices, integrations and their failing sync jobs. */
function Health() {
  const { text, number } = useLanguage();
  const health = useQuery({ queryKey: ['admin', 'pos', 'health'], queryFn: adminPosApi.health, refetchInterval: 60_000 });
  if (health.isError) return <ErrorPanel error={health.error} onRetry={() => void health.refetch()} />;
  if (!health.data) return <Skeleton height={140} />;
  const data = health.data;
  const tiles: [string, number, string, Icon, string][] = [
    [text('مطاعم شغال عندها', 'Restaurants active'), data.restaurants.ACTIVE, text(`${number(data.restaurants.PENDING_SETUP)} محتاجين إعداد · ${number(data.restaurants.SUSPENDED)} موقوفين`, `${data.restaurants.PENDING_SETUP} pending setup · ${data.restaurants.SUSPENDED} suspended`), StorefrontIcon, 'coral'],
    [text('أجهزة', 'Devices'), data.devices.active, text(`${number(data.devices.revoked)} ملغية`, `${data.devices.revoked} revoked`), DesktopIcon, 'plum'],
    [text('ربط خارجي', 'Integrations'), data.integrations.active, text(`${number(data.integrations.paused)} متوقف · ${number(data.integrations.disconnected)} مفصول`, `${data.integrations.paused} paused · ${data.integrations.disconnected} disconnected`), PlugsConnectedIcon, 'green'],
    [text('مزامنة فشلت', 'Failed sync jobs'), data.jobs.dead, text(`${number(data.jobs.pending)} مستني · ${number(data.jobs.succeededLastDay)} نجح آخر ٢٤ ساعة`, `${data.jobs.pending} pending · ${data.jobs.succeededLastDay} succeeded in 24 h`), WarningCircleIcon, data.jobs.dead ? 'coral' : 'yellow'],
  ];
  return <section aria-labelledby="pos-health" className="admin-pos-health">
    <h2 id="pos-health" className="visually-hidden">{text('الحالة', 'Health')}</h2>
    <dl className="admin-pos-tiles">{tiles.map(([label, value, note, TileIcon, tone]) => <div key={label} className="ad-card">
      <dt><span className={`ad-icon tone-${tone}`} aria-hidden="true"><TileIcon size={18} weight="bold" /></span>{label}</dt><dd>{number(value)}</dd><small>{note}</small></div>)}</dl>
    {data.failing.length > 0 && <div className="ad-card table-scroll"><table className="data-table"><thead><tr><th>{text('المطعم', 'Restaurant')}</th><th>{text('الربط', 'Integration')}</th><th>{text('فشل', 'Failed')}</th><th>{text('آخر خطأ', 'Last error')}</th></tr></thead>
      <tbody>{data.failing.map(row => <tr key={row.integrationId}><td>{row.restaurantName}</td><td>{row.name} · {row.provider}</td><td>{number(row.dead)}</td><td className="muted">{row.lastError ?? '—'}</td></tr>)}</tbody></table></div>}
  </section>;
}

function PosAudit() {
  const { text, language } = useLanguage();
  const audit = useQuery({ queryKey: ['admin', 'pos', 'audit'], queryFn: adminPosApi.audit });
  return <section className="ad-card" aria-labelledby="pos-audit">
    <header className="ad-card-head"><div><h2 id="pos-audit">{text('سجل الكاشير', 'POS audit log')}</h2><p className="muted">{text('التفعيل والصلاحيات والإعدادات والأجهزة والمرتجعات والربط والـ webhooks المرفوضة.', 'Activation, access, settings, devices, refunds, integrations and rejected webhooks.')}</p></div></header>
    {audit.isError && <ErrorPanel error={audit.error} onRetry={() => void audit.refetch()} />}
    {audit.isPending && <Skeleton height={160} />}
    {audit.data && (audit.data.length === 0 ? <p className="muted">{text('لسه مفيش.', 'Nothing yet.')}</p> : <div className="table-scroll"><table className="data-table">
      <thead><tr><th>{text('الوقت', 'When')}</th><th>{text('الحدث', 'Action')}</th><th>{text('المطعم', 'Restaurant')}</th><th>{text('مين', 'By')}</th></tr></thead>
      <tbody>{audit.data.map(entry => <tr key={entry.id}><td>{formatDate(entry.createdAt, language, { dateStyle: 'short', timeStyle: 'short' })}</td><td><code>{entry.action}</code></td><td>{entry.restaurant?.name ?? '—'}</td><td>{entry.actor?.name ?? text('النظام', 'System')}</td></tr>)}</tbody>
    </table></div>)}
  </section>;
}

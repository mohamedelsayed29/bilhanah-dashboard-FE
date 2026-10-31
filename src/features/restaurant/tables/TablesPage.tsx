import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowsClockwiseIcon, ChairIcon, CheckIcon, DownloadSimpleIcon, FileSvgIcon, ListNumbersIcon, PencilSimpleIcon, PlusIcon, PrinterIcon, TableIcon, TrashIcon, XIcon,
} from '@phosphor-icons/react';
import { ORDER_ERROR_CODES, ORDER_LIMITS, type RestaurantTable } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { PageSkeleton } from '../../../components/Skeleton';
import { Switch } from '../../../components/Switch';
import { useToast } from '../../../components/Toast';
import { isApiError } from '../../../lib/api';
import { tablesApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { queryKeys, useRestaurant, useTablesQuery } from '../queries';
import { downloadPng, downloadSvg, qrFilename } from './qr-download';
import { AddRangeDialog, AddTableDialog, TABLE_SHAPE_OPTIONS, TableLayoutDialog } from './TableDialogs';
import { TablesFloor, useFloorQuery } from './TablesFloor';
import { TableShapeIcon } from './TableGraphic';

const replaceTable = (tables: RestaurantTable[] | undefined, table: RestaurantTable) => tables?.map(entry => (entry.id === table.id ? table : entry));

function useTableMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { text } = useLanguage();
  const onError = (error: unknown) => {
    toast.error(errorMessage(error, text));
    if (isApiError(error, ORDER_ERROR_CODES.TABLE_NOT_FOUND)) void queryClient.invalidateQueries({ queryKey: queryKeys.tables });
  };
  const setActive = useMutation({
    mutationFn: ({ table, isActive }: { table: RestaurantTable; isActive: boolean }) => tablesApi.update(table.id, { isActive }),
    onMutate: ({ table, isActive }) => {
      const previous = table;
      queryClient.setQueryData<RestaurantTable[]>(queryKeys.tables, tables => replaceTable(tables, { ...table, isActive }));
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context) queryClient.setQueryData<RestaurantTable[]>(queryKeys.tables, tables => replaceTable(tables, context.previous));
      onError(error);
    },
    onSuccess: table => {
      queryClient.setQueryData<RestaurantTable[]>(queryKeys.tables, tables => replaceTable(tables, table));
      toast.success(table.isActive ? text(`«${table.label}» شغالة`, `“${table.label}” is active`) : text(`«${table.label}» اتقفلت`, `“${table.label}” is turned off`));
    },
  });
  const rename = useMutation({
    mutationFn: ({ table, label }: { table: RestaurantTable; label: string }) => tablesApi.update(table.id, { label }),
    onSuccess: table => {
      queryClient.setQueryData<RestaurantTable[]>(queryKeys.tables, tables => replaceTable(tables, table));
      toast.success(text('اتغيّر اسم الطاولة', 'Table renamed'));
    },
  });
  const regenerate = useMutation({
    mutationFn: (table: RestaurantTable) => tablesApi.regenerateCode(table.id),
    onSuccess: table => {
      queryClient.setQueryData<RestaurantTable[]>(queryKeys.tables, tables => replaceTable(tables, table));
      toast.success(text(`كود جديد لـ«${table.label}». اطبعه تاني.`, `New code for “${table.label}”. Print it again.`));
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (table: RestaurantTable) => tablesApi.remove(table.id),
    onSuccess: (_data, table) => {
      queryClient.setQueryData<RestaurantTable[]>(queryKeys.tables, tables => tables?.filter(entry => entry.id !== table.id));
      toast.success(text(`مسحنا «${table.label}»`, `“${table.label}” deleted`));
    },
    onError,
  });
  return { setActive, rename, regenerate, remove };
}

type Mutations = ReturnType<typeof useTableMutations>;

function TableItem({ table, subdomain, mutations, occupied, onLayout, onRegenerate, onDelete }: {
  table: RestaurantTable; subdomain: string; mutations: Mutations; occupied: boolean | undefined; onLayout: () => void; onRegenerate: () => void; onDelete: () => void;
}) {
  const { text, count } = useLanguage();
  const shape = TABLE_SHAPE_OPTIONS.find(option => option.value === table.shape) ?? TABLE_SHAPE_OPTIONS[1];
  const toast = useToast();
  const svgRef = useRef<SVGSVGElement>(null);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(table.label);
  const [error, setError] = useState<string | null>(null);
  const filename = qrFilename(subdomain, table.label);
  const save = () => {
    const value = label.trim();
    if (!value) { setError(text('اكتب اسم الطاولة.', 'Enter a table name.')); return; }
    if (value === table.label) { setEditing(false); return; }
    mutations.rename.mutate({ table, label: value }, {
      onSuccess: () => setEditing(false),
      onError: failure => setError(errorMessage(failure, text)),
    });
  };
  const png = () => {
    if (!svgRef.current) return;
    downloadPng(svgRef.current, filename).then(
      () => toast.success(text('نزلت صورة PNG', 'PNG downloaded')),
      () => toast.error(text('مقدرناش نعمل الصورة. جرّب SVG.', 'Could not create the image. Try SVG.')),
    );
  };
  const svg = () => {
    if (!svgRef.current) return;
    downloadSvg(svgRef.current, filename);
    toast.success(text('نزل ملف SVG', 'SVG downloaded'));
  };
  const inputId = `table-${table.id}-label`;
  const state = occupied === undefined ? '' : occupied ? 'is-busy' : 'is-free';
  return <li className={`card table-item ${table.isActive ? '' : 'is-off'} ${state}`} data-testid="table-item" data-label={table.label}>
    <div className="table-item-main">
      <div className="table-item-qr">
        <QRCodeSVG ref={svgRef} value={table.qrUrl} size={104} level="M" marginSize={2} bgColor="#ffffff" fgColor="#111111"
          title={text(`كود QR لـ${table.label}`, `QR code for ${table.label}`)} role="img" />
      </div>
      <div className="table-item-body">
        {editing
          ? <form className="table-rename" noValidate onSubmit={event => { event.preventDefault(); save(); }}>
            <label className="visually-hidden" htmlFor={inputId}>{text('اسم الطاولة', 'Table name')}</label>
            <input id={inputId} className="input" autoFocus maxLength={40} value={label} aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
              onChange={event => { setLabel(event.target.value); setError(null); }}
              onKeyDown={event => { if (event.key === 'Escape') { setEditing(false); setLabel(table.label); setError(null); } }} />
            <button type="submit" className="icon-button" aria-label={text('احفظ الاسم', 'Save name')} disabled={mutations.rename.isPending}><CheckIcon size={20} weight="bold" /></button>
            <button type="button" className="icon-button" aria-label={text('إلغاء', 'Cancel')} onClick={() => { setEditing(false); setLabel(table.label); setError(null); }}><XIcon size={20} /></button>
            {error && <p className="field-error" id={`${inputId}-error`}>{error}</p>}
          </form>
          : <>{state && <span className={`table-state ${state}`}>{occupied ? text('عليها ناس', 'Occupied') : text('فاضية', 'Free')}</span>}<div className="table-item-title">
            <h3><bdi>{table.label}</bdi></h3>
            <button type="button" className="icon-button" aria-label={text(`غيّر اسم ${table.label}`, `Rename ${table.label}`)} onClick={() => { setLabel(table.label); setEditing(true); }}><PencilSimpleIcon size={18} /></button>
          </div>
          <button type="button" className="table-item-layout" onClick={onLayout} title={text('غيّر الشكل وعدد الأفراد', 'Change the shape and seats')}>
            <TableShapeIcon shape={table.shape} size={16} />{text(shape.ar, shape.en)} · {count(table.seats, 'seat')}
            <span className="visually-hidden">{text(`: غيّر شكل ${table.label}`, `: change ${table.label}`)}</span><PencilSimpleIcon size={14} aria-hidden="true" />
          </button></>}
        <Switch checked={table.isActive} onChange={isActive => mutations.setActive.mutate({ table, isActive })}
          label={text('بتستقبل طلبات', 'Takes orders')}
          description={table.isActive ? text('الكود شغال', 'The code works') : text('الكود متوقف مؤقتًا', 'The code is switched off')} />
      </div>
    </div>
    <div className="table-item-actions">
      <Button small variant="ghost" onClick={png} icon={<DownloadSimpleIcon size={16} aria-hidden="true" />} aria-label={text(`نزّل PNG لـ${table.label}`, `Download PNG for ${table.label}`)}>PNG</Button>
      <Button small variant="ghost" onClick={svg} icon={<FileSvgIcon size={16} aria-hidden="true" />} aria-label={text(`نزّل SVG لـ${table.label}`, `Download SVG for ${table.label}`)}>SVG</Button>
      <Button small variant="ghost" onClick={onLayout} icon={<ChairIcon size={16} aria-hidden="true" />}>{text('الشكل', 'Layout')}</Button>
      <Button small variant="ghost" onClick={onRegenerate} icon={<ArrowsClockwiseIcon size={16} aria-hidden="true" />}>{text('كود جديد', 'New code')}</Button>
      <button type="button" className="icon-button icon-button-danger" onClick={onDelete} aria-label={text(`امسح ${table.label}`, `Delete ${table.label}`)}><TrashIcon size={18} /></button>
    </div>
  </li>;
}

export function TablesPage() {
  const { text, count } = useLanguage();
  usePageTitle('الطاولات', 'Tables');
  const restaurant = useRestaurant();
  const tables = useTablesQuery();
  const mutations = useTableMutations();
  const floor = useFloorQuery(restaurant.ordering.included);
  const [adding, setAdding] = useState<'one' | 'range' | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'code' | 'delete'; table: RestaurantTable } | null>(null);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const { ordering } = restaurant;

  if (tables.isPending) return <PageSkeleton blocks={2} />;
  if (tables.isError) return <div className="page"><ErrorPanel error={tables.error} onRetry={() => void tables.refetch()} /></div>;
  const list = tables.data;
  const active = list.filter(table => table.isActive).length;
  const full = list.length >= ORDER_LIMITS.tables;
  const busy = confirm?.kind === 'code' ? mutations.regenerate.isPending : mutations.remove.isPending;

  return <div className="page tables-page">
    <PageHeader title={text('الطاولات', 'Tables')}
      description={text('كل طاولة ليها كود QR خاص بيها: الزبون يمسحه ويطلب، والطلب يوصلك عليه اسم الطاولة.', 'Each table has its own QR code: diners scan it to order, and the order reaches you with the table name.')}
      actions={<>
        {list.length > 0 && <Link className="button button-secondary" to="/tables/print"><PrinterIcon size={18} aria-hidden="true" />{text('اطبع الأكواد', 'Print QR codes')}</Link>}
        <Button variant="secondary" disabled={full} onClick={() => setAdding('range')} icon={<ListNumbersIcon size={18} aria-hidden="true" />}>{text('ضيف كذا طاولة', 'Add several')}</Button>
        <Button disabled={full} onClick={() => setAdding('one')} icon={<PlusIcon size={18} aria-hidden="true" />}>{text('ضيف طاولة', 'Add table')}</Button>
      </>} />

    {!ordering.included && <Alert kind="info" live={false} title={text('الطلب من الطاولة محتاج باقة فيها طلبات', 'Ordering from tables needs a plan with ordering')}
      actions={<Link className="link-action" to="/subscription">{text('شوف الباقات', 'See plans')}</Link>}>
      {text('تقدر تجهّز طاولاتك وأكوادها دلوقتي، والزباين هيقدروا يطلبوا منها أول ما تشترك في «منيو وطلبات».', 'You can set up tables and codes now; diners can order from them once you are on “Menu & Orders”.')}
    </Alert>}
    {ordering.included && (!ordering.enabled || !ordering.acceptsDineIn) && <Alert kind="warning" live={false}
      title={!ordering.enabled ? text('الطلبات مش متشغّلة', 'Ordering is switched off') : text('طلبات الصالة مقفولة', 'Dine-in orders are switched off')}
      actions={<Link className="link-action" to="/settings/ordering">{text('إعدادات الطلبات', 'Ordering settings')}</Link>}>
      {text('الزبون اللي يمسح كود الطاولة هيشوف المنيو بس، من غير طلب.', 'Diners who scan a table code will see the menu but cannot order.')}
    </Alert>}
    {full && <Alert kind="warning" live={false}>{text(`وصلت للحد الأقصى (${count(ORDER_LIMITS.tables, 'table')}). امسح طاولة عشان تضيف غيرها.`, `You reached the limit of ${count(ORDER_LIMITS.tables, 'table')}. Delete one to add another.`)}</Alert>}

    {ordering.included && list.length > 0 && <TablesFloor />}

    {list.length === 0
      ? <section className="card empty-state" aria-labelledby="tables-empty-title">
        <span className="empty-state-icon" aria-hidden="true"><TableIcon size={30} /></span>
        <h2 id="tables-empty-title">{text('ضيف طاولاتك', 'Add your tables')}</h2>
        <p>{text('ضيف الطاولات مرة واحدة (مثلًا من ١ لـ ٢٠)، واطبع كارت QR لكل طاولة.', 'Add your tables in one go (for example 1 to 20), then print a QR card for each one.')}</p>
        <div className="form-actions">
          <Button onClick={() => setAdding('range')} icon={<ListNumbersIcon size={18} aria-hidden="true" />}>{text('ضيف كذا طاولة', 'Add several')}</Button>
          <Button variant="secondary" onClick={() => setAdding('one')} icon={<PlusIcon size={18} aria-hidden="true" />}>{text('ضيف طاولة', 'Add table')}</Button>
        </div>
      </section>
      : <section className="section" aria-labelledby="tables-title">
        <div className="section-head">
          <h2 id="tables-title">{text('طاولاتك', 'Your tables')}</h2>
          <p data-testid="tables-count">{text(`${count(list.length, 'table')} · ${count(active, [{ one: 'واحدة شغالة', two: 'اتنين شغالين', few: '{n} شغالة', many: '{n} شغالة', zero: 'مفيش ولا واحدة شغالة' }, { one: '{n} active', other: '{n} active' }])}`, `${count(list.length, 'table')} · ${active} active`)}</p>
        </div>
        <ul className="tables-grid">
          {list.map(table => <TableItem key={table.id} table={table} subdomain={restaurant.subdomain} mutations={mutations}
            occupied={table.isActive ? floor.data?.find(entry => entry.id === table.id)?.occupied : undefined}
            onLayout={() => setLayoutId(table.id)} onRegenerate={() => setConfirm({ kind: 'code', table })} onDelete={() => setConfirm({ kind: 'delete', table })} />)}
        </ul>
      </section>}

    <AddTableDialog open={adding === 'one'} onClose={() => setAdding(null)} />
    <AddRangeDialog open={adding === 'range'} onClose={() => setAdding(null)} existing={list.length} />
    <TableLayoutDialog table={list.find(table => table.id === layoutId) ?? null} onClose={() => setLayoutId(null)} />
    <ConfirmDialog open={confirm !== null} busy={busy} onCancel={() => setConfirm(null)}
      title={confirm?.kind === 'code' ? text(`كود جديد لـ«${confirm.table.label}»؟`, `New code for “${confirm?.table.label}”?`) : text(`امسح «${confirm?.table.label ?? ''}»؟`, `Delete “${confirm?.table.label ?? ''}”?`)}
      description={confirm?.kind === 'code'
        ? text('الكود المطبوع حاليًا على الطاولة دي هيبطل يشتغل، ولازم تطبع الكارت الجديد. استخدمها لو حد صوّر الكود أو أخده.', 'The code printed on this table stops working and you will need to print the new card. Use this if the code was copied or taken.')
        : text('الكود بتاعها هيبطل يشتغل. الطلبات القديمة مش هتتأثر.', 'Its QR code stops working. Past orders are not affected.')}
      confirmLabel={confirm?.kind === 'code' ? text('اعمل كود جديد', 'Create new code') : text('امسح', 'Delete')}
      onConfirm={() => {
        if (!confirm) return;
        const mutation = confirm.kind === 'code' ? mutations.regenerate : mutations.remove;
        mutation.mutate(confirm.table, { onSettled: () => setConfirm(null) });
      }} />
  </div>;
}

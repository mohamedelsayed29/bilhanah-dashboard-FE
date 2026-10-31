import { useEffect, useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MinusIcon, PlusIcon } from '@phosphor-icons/react';
import { ORDER_ERROR_CODES, ORDER_LIMITS, type RestaurantTable, TABLE_SEATS, type TableShape } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Dialog } from '../../../components/Dialog';
import { Field } from '../../../components/Field';
import { useToast } from '../../../components/Toast';
import { isApiError } from '../../../lib/api';
import { tablesApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { normalizeDigits } from '../../../lib/format';
import { useLanguage } from '../../../lib/language';
import { queryKeys } from '../queries';
import { rangeLabel } from './qr-download';
import { TableGraphic, TableShapeIcon } from './TableGraphic';

export const TABLE_SHAPE_OPTIONS = [
  { value: 'ROUND', ar: 'مدورة', en: 'Round' },
  { value: 'SQUARE', ar: 'مربعة', en: 'Square' },
  { value: 'RECTANGLE', ar: 'مستطيلة', en: 'Rectangle' },
] as const satisfies readonly { value: TableShape; ar: string; en: string }[];

type TableLayout = { shape: TableShape; seats: number };
const DEFAULT_LAYOUT: TableLayout = { shape: 'SQUARE', seats: TABLE_SEATS.default };
const clampSeats = (value: number) => Math.min(TABLE_SEATS.max, Math.max(TABLE_SEATS.min, value));

/** The table's shape and how many guests it seats, with a drawing of how it shows on the floor. */
function TableLayoutFields({ value, onChange, label }: { value: TableLayout; onChange: (layout: TableLayout) => void; label: string }) {
  const { text, number, count } = useLanguage();
  const name = useId();
  const [draft, setDraft] = useState(String(value.seats));
  useEffect(() => setDraft(String(value.seats)), [value.seats]);
  const setSeats = (seats: number) => onChange({ ...value, seats: clampSeats(seats) });
  const commitDraft = () => {
    const seats = Number.parseInt(normalizeDigits(draft), 10);
    if (Number.isInteger(seats)) setSeats(seats); else setDraft(String(value.seats));
  };
  return <div className="table-layout-fields">
    <fieldset className="field">
      <legend className="field-label">{text('شكل الترابيزة', 'Table shape')}</legend>
      <div className="segmented">
        {TABLE_SHAPE_OPTIONS.map(option => <label key={option.value}>
          <input type="radio" name={name} value={option.value} checked={value.shape === option.value} onChange={() => onChange({ ...value, shape: option.value })} />
          <TableShapeIcon shape={option.value} />{text(option.ar, option.en)}
        </label>)}
      </div>
    </fieldset>
    <Field label={text('عدد الأفراد', 'Seats')} hint={text(`من ${number(TABLE_SEATS.min)} لـ ${number(TABLE_SEATS.max)}. الكراسي بتترسم حوالين الترابيزة.`, `${TABLE_SEATS.min} to ${TABLE_SEATS.max}. Chairs are drawn around the table.`)}>
      {control => <div className="seat-stepper">
        <button type="button" className="icon-button" onClick={() => setSeats(value.seats - 1)} disabled={value.seats <= TABLE_SEATS.min} aria-label={text('فرد أقل', 'One seat fewer')}><MinusIcon size={18} weight="bold" /></button>
        <input {...control} className="input" inputMode="numeric" dir="ltr" maxLength={2} value={draft}
          onChange={event => setDraft(event.target.value)} onBlur={commitDraft}
          onKeyDown={event => { if (event.key === 'Enter') commitDraft(); }} />
        <button type="button" className="icon-button" onClick={() => setSeats(value.seats + 1)} disabled={value.seats >= TABLE_SEATS.max} aria-label={text('فرد زيادة', 'One more seat')}><PlusIcon size={18} weight="bold" /></button>
      </div>}
    </Field>
    <div className="table-layout-preview" aria-hidden="true">
      <TableGraphic shape={value.shape} seats={value.seats}>
        <bdi className="table-top-label">{label}</bdi>
        <small>{count(value.seats, 'seat')}</small>
      </TableGraphic>
    </div>
  </div>;
}

/** Adds one table. TABLE_LABEL_TAKEN is shown on the field. */
export function AddTableDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setLabel(''); setLayout(DEFAULT_LAYOUT); setError(null); } }, [open]);
  const create = useMutation({
    mutationFn: (value: string) => tablesApi.create({ label: value, ...layout }),
    onSuccess: table => {
      queryClient.setQueryData<RestaurantTable[]>(queryKeys.tables, current => [...(current ?? []), table]);
      toast.success(text(`ضفنا «${table.label}»`, `“${table.label}” added`));
      onClose();
    },
  });
  const submit = () => {
    const value = label.trim();
    if (!value) { setError(text('اكتب اسم الطاولة.', 'Enter a table name.')); return; }
    create.mutate(value);
  };
  const apiError = create.error;
  const labelProblem = isApiError(apiError, ORDER_ERROR_CODES.TABLE_LABEL_TAKEN) ? errorMessage(apiError, text) : error;
  return <Dialog open={open} onClose={onClose} size="small" busy={create.isPending} onSubmit={submit} title={text('ضيف طاولة', 'Add a table')}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={create.isPending}>{text('إلغاء', 'Cancel')}</Button>
      <Button type="submit" loading={create.isPending}>{text('ضيف', 'Add table')}</Button>
    </>}>
    <div className="form">
      {apiError && !isApiError(apiError, ORDER_ERROR_CODES.TABLE_LABEL_TAKEN) && <Alert kind="error">{errorMessage(apiError, text)}</Alert>}
      <Field label={text('اسم الطاولة', 'Table name')} hint={text('زي «طاولة ٥» أو «تراس ٢». الاسم ده بيظهر على الكارت وفي الطلب.', 'For example “Table 5” or “Terrace 2”. It is printed on the card and shown with each order.')}
        error={labelProblem ? { message: labelProblem } : undefined}>
        <input className="input" data-autofocus maxLength={40} value={label} onChange={event => { setLabel(event.target.value); setError(null); create.reset(); }} />
      </Field>
      <TableLayoutFields value={layout} onChange={setLayout} label={label.trim() || text('طاولة', 'Table')} />
    </div>
  </Dialog>;
}

const PREFIXES = [['طاولة', 'Table'], ['ترابيزة', 'T-'], ['تراس', 'Terrace']] as const;

/** Adds "{prefix} {from}" … "{prefix} {to}" at once; names that already exist are skipped by the API. */
export function AddRangeDialog({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: number }) {
  const { text, count: counted } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [prefix, setPrefix] = useState('');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('10');
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  useEffect(() => {
    if (!open) return;
    setPrefix(text('طاولة', 'Table'));
    setFrom('1');
    setTo('10');
    setLayout(DEFAULT_LAYOUT);
  }, [open, text]);
  const create = useMutation({
    mutationFn: (body: { from: number; to: number; prefix: string }) => tablesApi.createRange({ ...body, ...layout }),
    onSuccess: tables => {
      const added = tables.length - existing;
      queryClient.setQueryData(queryKeys.tables, tables);
      toast.success(added > 0 ? text(`ضفنا ${counted(added, 'table')}`, `${counted(added, 'table')} added`) : text('كل الطاولات دي موجودة بالفعل', 'All these tables already exist'));
      onClose();
    },
  });
  const start = Number.parseInt(normalizeDigits(from), 10);
  const end = Number.parseInt(normalizeDigits(to), 10);
  const count = end - start + 1;
  const fromError = !Number.isInteger(start) || start < 1 || start > 999 ? text('رقم من ١ لـ ٩٩٩.', 'A number from 1 to 999.') : null;
  const toError = !Number.isInteger(end) || end < 1 || end > 999 ? text('رقم من ١ لـ ٩٩٩.', 'A number from 1 to 999.')
    : !fromError && end < start ? text('لازم يكون أكبر من أو يساوي رقم البداية.', 'Must be at least the first number.')
      : !fromError && count > ORDER_LIMITS.bulkTables ? text(`لحد ${counted(ORDER_LIMITS.bulkTables, 'table')} في المرة.`, `Up to ${counted(ORDER_LIMITS.bulkTables, 'table')} at a time.`) : null;
  const valid = !fromError && !toError;
  const comma = text('، ', ', ');
  const preview = valid
    ? count <= 3 ? Array.from({ length: count }, (_, index) => rangeLabel(prefix, start + index)).join(comma)
      : `${rangeLabel(prefix, start)}${comma}${rangeLabel(prefix, start + 1)} … ${rangeLabel(prefix, end)}`
    : null;
  const submit = () => { if (valid) create.mutate({ from: start, to: end, prefix: prefix.trim() }); };
  return <Dialog open={open} onClose={onClose} busy={create.isPending} onSubmit={submit} title={text('ضيف طاولات مرة واحدة', 'Add several tables')}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={create.isPending}>{text('إلغاء', 'Cancel')}</Button>
      <Button type="submit" loading={create.isPending} disabled={!valid}>{valid ? text(`ضيف ${counted(count, 'table')}`, `Add ${counted(count, 'table')}`) : text('ضيف', 'Add')}</Button>
    </>}>
    <div className="form">
      {create.isError && <Alert kind="error">{errorMessage(create.error, text)}</Alert>}
      <Field label={text('الاسم قبل الرقم', 'Name before the number')} optional hint={text('اسيبه فاضي لو عايز أرقام بس.', 'Leave it empty for numbers only.')}>
        <input className="input" data-autofocus maxLength={20} value={prefix} onChange={event => setPrefix(event.target.value)} />
      </Field>
      <div className="chips range-chips" role="group" aria-label={text('أسماء مقترحة', 'Suggested names')}>
        {PREFIXES.map(([ar, en]) => {
          const value = text(ar, en);
          return <button type="button" key={value} className="chip" aria-pressed={prefix === value} onClick={() => setPrefix(value)}>{value}</button>;
        })}
      </div>
      <div className="form-grid range-grid">
        <Field label={text('من رقم', 'From')} error={fromError ? { message: fromError } : undefined}>
          <input className="input" inputMode="numeric" dir="ltr" maxLength={3} value={from} onChange={event => setFrom(event.target.value)} />
        </Field>
        <Field label={text('لحد رقم', 'To')} error={toError ? { message: toError } : undefined}>
          <input className="input" inputMode="numeric" dir="ltr" maxLength={3} value={to} onChange={event => setTo(event.target.value)} />
        </Field>
      </div>
      {preview && <div className="range-preview" aria-live="polite" data-testid="range-preview">
        <strong>{preview}</strong>
        <small className="muted">{text(`${counted(count, 'table')}. الأسماء الموجودة بالفعل مش هتتكرر.`, `${counted(count, 'table')}. Names that already exist are skipped.`)}</small>
      </div>}
      <TableLayoutFields value={layout} onChange={setLayout} label={rangeLabel(prefix, Number.isInteger(start) ? start : 1)} />
    </div>
  </Dialog>;
}

/** Changes a table's shape and seats; its name and QR code stay the same. */
export function TableLayoutDialog({ table, onClose }: { table: RestaurantTable | null; onClose: () => void }) {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  useEffect(() => { if (table) setLayout({ shape: table.shape, seats: table.seats }); }, [table]);
  const save = useMutation({
    mutationFn: (target: RestaurantTable) => tablesApi.update(target.id, layout),
    onSuccess: updated => {
      queryClient.setQueryData<RestaurantTable[]>(queryKeys.tables, tables => tables?.map(entry => (entry.id === updated.id ? updated : entry)));
      void queryClient.invalidateQueries({ queryKey: queryKeys.floor });
      toast.success(text(`اتحفظ شكل «${updated.label}»`, `“${updated.label}” updated`));
      onClose();
    },
  });
  return <Dialog open={table !== null} onClose={onClose} size="small" busy={save.isPending} onSubmit={() => table && save.mutate(table)}
    title={table ? text(`شكل «${table.label}»`, `“${table.label}” layout`) : ''}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={save.isPending}>{text('إلغاء', 'Cancel')}</Button>
      <Button type="submit" loading={save.isPending}>{text('احفظ', 'Save')}</Button>
    </>}>
    <div className="form">
      {save.isError && <Alert kind="error">{errorMessage(save.error, text)}</Alert>}
      {table && <TableLayoutFields value={layout} onChange={setLayout} label={table.label} />}
    </div>
  </Dialog>;
}

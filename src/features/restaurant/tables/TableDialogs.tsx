import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ORDER_ERROR_CODES, ORDER_LIMITS, type RestaurantTable } from '@bilhanah/contracts';
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

/** Adds one table. TABLE_LABEL_TAKEN is shown on the field. */
export function AddTableDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setLabel(''); setError(null); } }, [open]);
  const create = useMutation({
    mutationFn: (value: string) => tablesApi.create(value),
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
    </div>
  </Dialog>;
}

const PREFIXES = [['طاولة', 'Table'], ['ترابيزة', 'T-'], ['تراس', 'Terrace']] as const;

/** Adds "{prefix} {from}" … "{prefix} {to}" at once; names that already exist are skipped by the API. */
export function AddRangeDialog({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: number }) {
  const { text, number } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [prefix, setPrefix] = useState('');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('10');
  useEffect(() => {
    if (!open) return;
    setPrefix(text('طاولة', 'Table'));
    setFrom('1');
    setTo('10');
  }, [open, text]);
  const create = useMutation({
    mutationFn: (body: { from: number; to: number; prefix: string }) => tablesApi.createRange(body),
    onSuccess: tables => {
      const added = tables.length - existing;
      queryClient.setQueryData(queryKeys.tables, tables);
      toast.success(added > 0 ? text(`ضفنا ${number(added)} طاولة`, `${added} table${added === 1 ? '' : 's'} added`) : text('كل الطاولات دي موجودة بالفعل', 'All these tables already exist'));
      onClose();
    },
  });
  const start = Number.parseInt(normalizeDigits(from), 10);
  const end = Number.parseInt(normalizeDigits(to), 10);
  const count = end - start + 1;
  const fromError = !Number.isInteger(start) || start < 1 || start > 999 ? text('رقم من ١ لـ ٩٩٩.', 'A number from 1 to 999.') : null;
  const toError = !Number.isInteger(end) || end < 1 || end > 999 ? text('رقم من ١ لـ ٩٩٩.', 'A number from 1 to 999.')
    : !fromError && end < start ? text('لازم يكون أكبر من أو يساوي رقم البداية.', 'Must be at least the first number.')
      : !fromError && count > ORDER_LIMITS.bulkTables ? text(`لحد ${number(ORDER_LIMITS.bulkTables)} طاولة في المرة.`, `Up to ${ORDER_LIMITS.bulkTables} tables at a time.`) : null;
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
      <Button type="submit" loading={create.isPending} disabled={!valid}>{valid ? text(`ضيف ${number(count)} طاولة`, `Add ${count} table${count === 1 ? '' : 's'}`) : text('ضيف', 'Add')}</Button>
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
        <span className="eyebrow">{text('معاينة', 'Preview')}</span>
        <strong>{preview}</strong>
        <small className="muted">{text(`${number(count)} طاولة. الأسماء الموجودة بالفعل مش هتتكرر.`, `${count} table${count === 1 ? '' : 's'}. Names that already exist are skipped.`)}</small>
      </div>}
    </div>
  </Dialog>;
}

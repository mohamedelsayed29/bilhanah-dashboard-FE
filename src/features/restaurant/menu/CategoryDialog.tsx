import { useForm } from 'react-hook-form';
import { createCategorySchema, type OwnerMenuCategory } from '@bilhanah/contracts';
import { Button } from '../../../components/Button';
import { Dialog } from '../../../components/Dialog';
import { Field } from '../../../components/Field';
import { Alert } from '../../../components/Alert';
import { errorMessage } from '../../../lib/api/error-messages';
import { schemaResolver } from '../../../lib/forms';
import { useLanguage } from '../../../lib/language';
import { useMenuMutations } from './menu-mutations';

/** Create a category (optionally prefilled from a suggestion) or rename an existing one. */
export function CategoryDialog({ category, initialName, onClose }: { category?: OwnerMenuCategory; initialName?: { ar: string; en: string }; onClose: () => void }) {
  const { text } = useLanguage();
  const { saveCategory } = useMenuMutations();
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: schemaResolver(createCategorySchema),
    defaultValues: { nameAr: category?.nameAr ?? initialName?.ar ?? '', nameEn: category?.nameEn ?? initialName?.en ?? '' },
  });
  const submit = handleSubmit(values => saveCategory.mutate({ id: category?.id, values }, { onSuccess: onClose }));
  return <Dialog open onClose={onClose} busy={saveCategory.isPending} onSubmit={() => void submit()}
    title={category ? text('تعديل اسم القسم', 'Rename category') : text('قسم جديد', 'New category')}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={saveCategory.isPending}>{text('إلغاء', 'Cancel')}</Button>
      <Button type="submit" loading={saveCategory.isPending}>{category ? text('احفظ', 'Save') : text('أضف القسم', 'Add category')}</Button>
    </>}>
    <div className="form">
      {saveCategory.isError && <Alert kind="error">{errorMessage(saveCategory.error, text)}</Alert>}
      <Field label={text('الاسم بالعربي', 'Arabic name')} error={errors.nameAr} required hint={text('زي: مشويات، سندوتشات، مشروبات', 'e.g. مشويات، سندوتشات، مشروبات')}>
        <input className="input" dir="rtl" lang="ar" data-autofocus {...register('nameAr')} />
      </Field>
      <Field label={text('الاسم بالإنجليزي', 'English name')} error={errors.nameEn} optional hint={text('بيظهر للزباين اللي بيقروا المنيو بالإنجليزي.', 'Shown to diners reading the menu in English.')}>
        <input className="input" dir="ltr" lang="en" {...register('nameEn')} />
      </Field>
    </div>
  </Dialog>;
}

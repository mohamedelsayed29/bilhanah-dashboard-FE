import { useId, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, ClockCounterClockwiseIcon, PencilSimpleIcon, PlusIcon, StarIcon } from '@phosphor-icons/react';
import { type AdminFaqArticle, type AdminFaqCategory, FAQ_STATUSES, type FaqStatus, SUPPORT_LANGUAGES, SUPPORT_LIMITS, type SupportLanguage } from '@bilhanah/contracts';
import { Button } from '../../../components/Button';
import { Dialog } from '../../../components/Dialog';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import { supportApi } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/error-messages';
import { formatDate } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useDebounced } from '../../../lib/use-debounced';
import { supportKeys } from './AdminSupportPage';

const faqKeys = { categories: [...supportKeys.all, 'faq', 'categories'] as const, articles: [...supportKeys.all, 'faq', 'articles'] as const };
const list = (value: string) => value.split(/[,،\n]/).map(entry => entry.trim()).filter(Boolean);

/** The assistant's FAQ content: fixed answers in Arabic and English, published or draft, edited here without a deploy. */
export function AdminFaqPage() {
  const { text, number, language } = useLanguage();
  usePageTitle('الأسئلة الشائعة', 'FAQ content');
  const [lang, setLang] = useState<SupportLanguage | ''>('');
  const [status, setStatus] = useState<FaqStatus | ''>('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [editing, setEditing] = useState<AdminFaqArticle | 'new' | null>(null);
  const [history, setHistory] = useState<AdminFaqArticle | null>(null);
  const categories = useQuery({ queryKey: faqKeys.categories, queryFn: supportApi.faqCategories, staleTime: 5 * 60_000 });
  const articles = useQuery({
    queryKey: [...faqKeys.articles, lang, status, category, q],
    queryFn: () => supportApi.faqArticles({ lang: lang || undefined, status: status || undefined, category: category || undefined, q: q || undefined }),
  });
  const categoryName = (id: string) => {
    const found = categories.data?.find(entry => entry.id === id);
    return found ? text(found.nameAr, found.nameEn) : '';
  };

  return <div className="page faq-admin">
    <Link to="/admin/support" className="back-link"><ArrowRightIcon size={16} className="directional" aria-hidden="true" />{text('الدعم الفني', 'Support')}</Link>
    <PageHeader title={text('الأسئلة الشائعة', 'FAQ content')}
      description={text('الإجابات اللي مساعد الدعم بيرد بيها على المطاعم. أي تعديل بيتحفظ كنسخة جديدة وبيظهر على طول، من غير ما نرفع نسخة جديدة من الداشبورد.', 'The answers the support assistant gives restaurants. Every edit is saved as a new version and is live straight away, with no dashboard release.')}
      actions={<Button icon={<PlusIcon size={18} aria-hidden="true" />} onClick={() => setEditing('new')} disabled={!categories.data}>{text('سؤال جديد', 'New question')}</Button>} />
    <div className="list-toolbar faq-filters">
      <input className="input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={text('ابحث بالسؤال أو المفتاح', 'Search by question or key')} aria-label={text('ابحث', 'Search')} />
      <select className="select" value={lang} onChange={event => setLang(event.target.value as SupportLanguage | '')} aria-label={text('اللغة', 'Language')}>
        <option value="">{text('كل اللغات', 'All languages')}</option>
        <option value="ar">{text('عربي', 'Arabic')}</option><option value="en">{text('إنجليزي', 'English')}</option>
      </select>
      <select className="select" value={status} onChange={event => setStatus(event.target.value as FaqStatus | '')} aria-label={text('الحالة', 'Status')}>
        <option value="">{text('كل الحالات', 'Any status')}</option>
        <option value="PUBLISHED">{text('منشور', 'Published')}</option><option value="DRAFT">{text('مسودة', 'Draft')}</option>
      </select>
      <select className="select" value={category} onChange={event => setCategory(event.target.value)} aria-label={text('القسم', 'Category')}>
        <option value="">{text('كل الأقسام', 'All categories')}</option>
        {(categories.data ?? []).map(entry => <option key={entry.id} value={entry.id}>{text(entry.nameAr, entry.nameEn)}</option>)}
      </select>
    </div>
    <section className="card list-card" aria-label={text('الأسئلة', 'Questions')} aria-busy={articles.isFetching}>
      {articles.isError && <ErrorPanel error={articles.error} onRetry={() => void articles.refetch()} />}
      {articles.isPending && <div className="table-skeleton" role="status" aria-label={text('جاري التحميل', 'Loading')}>{[0, 1, 2].map(index => <Skeleton key={index} height={44} />)}</div>}
      {articles.data && articles.data.length === 0 && <div className="empty-state"><h2>{text('مفيش أسئلة مطابقة', 'No matching questions')}</h2></div>}
      {articles.data && articles.data.length > 0 && <div className="table-scroll"><table className="data-table">
        <thead><tr>
          <th scope="col">{text('السؤال', 'Question')}</th><th scope="col">{text('القسم', 'Category')}</th><th scope="col">{text('الحالة', 'Status')}</th>
          <th scope="col">{text('المشاهدات', 'Views')}</th><th scope="col">{text('ساعدت؟', 'Helpful?')}</th><th scope="col"><span className="visually-hidden">{text('إجراءات', 'Actions')}</span></th>
        </tr></thead>
        <tbody>{articles.data.map(article => <tr key={article.id} data-testid="faq-row">
          <td className="cell-primary"><bdi dir={article.language === 'ar' ? 'rtl' : 'ltr'}>{article.question}</bdi>
            <small><span className="ltr">{article.key}</span> · {article.language === 'ar' ? text('عربي', 'Arabic') : text('إنجليزي', 'English')} · v{number(article.version)}{article.suggested && <> · <StarIcon size={12} weight="fill" aria-hidden="true" /> {text('مقترح', 'Suggested')}</>}</small></td>
          <td>{categoryName(article.categoryId)}</td>
          <td><span className={`faq-status is-${article.status.toLowerCase()}`}>{article.status === 'PUBLISHED' ? text('منشور', 'Published') : text('مسودة', 'Draft')}</span></td>
          <td>{number(article.views)}</td>
          <td className="cell-nowrap">{article.helpful + article.notHelpful === 0 ? '—' : text(`${number(article.helpful)} نعم · ${number(article.notHelpful)} لأ`, `${article.helpful} yes · ${article.notHelpful} no`)}</td>
          <td className="cell-action">
            <button type="button" className="icon-button" onClick={() => setHistory(article)} aria-label={text(`النسخ القديمة: ${article.question}`, `Versions: ${article.question}`)}><ClockCounterClockwiseIcon size={18} /></button>
            <button type="button" className="icon-button" onClick={() => setEditing(article)} aria-label={text(`عدّل: ${article.question}`, `Edit: ${article.question}`)} data-testid="faq-edit"><PencilSimpleIcon size={18} /></button>
          </td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    {editing && categories.data && <FaqDialog article={editing === 'new' ? null : editing} categories={categories.data} onClose={() => setEditing(null)} />}
    <Dialog open={history !== null} onClose={() => setHistory(null)} title={text('النسخ القديمة', 'Versions')}
      footer={<Button variant="secondary" onClick={() => setHistory(null)}>{text('إغلاق', 'Close')}</Button>}>
      {history && <Revisions id={history.id} language={language} />}
    </Dialog>
  </div>;
}

function Revisions({ id, language }: { id: string; language: SupportLanguage }) {
  const { text, number } = useLanguage();
  const revisions = useQuery({ queryKey: [...faqKeys.articles, 'revisions', id], queryFn: () => supportApi.faqRevisions(id) });
  if (revisions.isPending) return <Skeleton height={120} />;
  if (revisions.isError) return <ErrorPanel error={revisions.error} onRetry={() => void revisions.refetch()} />;
  return <ol className="faq-revisions">{revisions.data.map(revision => <li key={revision.version}>
    <strong>v{number(revision.version)}</strong> · {revision.status === 'PUBLISHED' ? text('منشور', 'Published') : text('مسودة', 'Draft')} · {revision.editorName ?? '—'} · {formatDate(revision.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
    <p><bdi>{revision.question}</bdi></p>
    <pre>{revision.answer}</pre>
  </li>)}</ol>;
}

function FaqDialog({ article, categories, onClose }: { article: AdminFaqArticle | null; categories: AdminFaqCategory[]; onClose: () => void }) {
  const { text } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const id = useId();
  const [form, setForm] = useState(() => ({
    key: article?.key ?? '', language: article?.language ?? 'ar' as SupportLanguage, categoryId: article?.categoryId ?? categories[0]!.id,
    question: article?.question ?? '', answer: article?.answer ?? '', keywords: (article?.keywords ?? []).join(', '), relatedKeys: (article?.relatedKeys ?? []).join(', '),
    suggested: article?.suggested ?? false, sortOrder: String(article?.sortOrder ?? 0), status: article?.status ?? 'DRAFT' as FaqStatus,
  }));
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(current => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        key: form.key.trim().toLowerCase(), language: form.language, categoryId: form.categoryId, question: form.question.trim(), answer: form.answer.trim(),
        keywords: list(form.keywords), relatedKeys: list(form.relatedKeys).map(key => key.toLowerCase()), suggested: form.suggested,
        sortOrder: Math.max(0, Math.round(Number(form.sortOrder) || 0)), status: form.status,
      };
      return article ? supportApi.updateFaq(article.id, body) : supportApi.createFaq(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: faqKeys.articles });
      toast.success(text('اتحفظ، وظاهر للمطاعم لو منشور', 'Saved; live for restaurants if published'));
      onClose();
    },
  });
  return <Dialog open onClose={onClose} title={article ? text('عدّل السؤال', 'Edit question') : text('سؤال جديد', 'New question')} size="wide" busy={save.isPending} onSubmit={() => save.mutate()}
    footer={<><Button variant="secondary" onClick={onClose}>{text('إلغاء', 'Cancel')}</Button><Button type="submit" loading={save.isPending} data-testid="faq-save">{text('احفظ', 'Save')}</Button></>}>
    <div className="faq-form">
      <div className="faq-form-row">
        <label className="field"><span>{text('المفتاح (نفسه للغتين)', 'Key (same in both languages)')}</span>
          <input className="input ltr" value={form.key} onChange={event => set('key', event.target.value)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} placeholder="add-menu-item" /></label>
        <label className="field"><span>{text('اللغة', 'Language')}</span>
          <select className="select" value={form.language} onChange={event => set('language', event.target.value as SupportLanguage)}>
            {SUPPORT_LANGUAGES.map(value => <option key={value} value={value}>{value === 'ar' ? text('عربي', 'Arabic') : text('إنجليزي', 'English')}</option>)}
          </select></label>
        <label className="field"><span>{text('القسم', 'Category')}</span>
          <select className="select" value={form.categoryId} onChange={event => set('categoryId', event.target.value)}>
            {categories.map(entry => <option key={entry.id} value={entry.id}>{text(entry.nameAr, entry.nameEn)}</option>)}
          </select></label>
      </div>
      <label className="field"><span>{text('السؤال', 'Question')}</span>
        <input className="input" dir={form.language === 'ar' ? 'rtl' : 'ltr'} value={form.question} onChange={event => set('question', event.target.value)} required maxLength={SUPPORT_LIMITS.question} /></label>
      <label className="field" htmlFor={`${id}-answer`}><span>{text('الإجابة', 'Answer')}</span></label>
      <textarea id={`${id}-answer`} className="input faq-answer" dir={form.language === 'ar' ? 'rtl' : 'ltr'} rows={8} value={form.answer} onChange={event => set('answer', event.target.value)} required maxLength={SUPPORT_LIMITS.answer} />
      <p className="field-hint">{text('تقدر تستخدم **كلام عريض**، وقوائم تبدأ بـ «- » أو «1. »، ولينكات زي [المنيو](/menu).', 'You can use **bold**, lists starting with “- ” or “1. ”, and links like [Menu](/menu).')}</p>
      <div className="faq-form-row">
        <label className="field"><span>{text('كلمات للبحث (افصلها بفاصلة)', 'Search keywords (comma-separated)')}</span>
          <input className="input" value={form.keywords} onChange={event => set('keywords', event.target.value)} /></label>
        <label className="field"><span>{text('أسئلة قريبة (مفاتيح)', 'Related questions (keys)')}</span>
          <input className="input ltr" value={form.relatedKeys} onChange={event => set('relatedKeys', event.target.value)} placeholder="sold-out-item, item-photo" /></label>
      </div>
      <div className="faq-form-row">
        <label className="field"><span>{text('الترتيب', 'Order')}</span><input className="input" type="number" min={0} max={10000} value={form.sortOrder} onChange={event => set('sortOrder', event.target.value)} /></label>
        <label className="field"><span>{text('الحالة', 'Status')}</span>
          <select className="select" value={form.status} onChange={event => set('status', event.target.value as FaqStatus)} data-testid="faq-status">
            {FAQ_STATUSES.map(value => <option key={value} value={value}>{value === 'PUBLISHED' ? text('منشور', 'Published') : text('مسودة', 'Draft')}</option>)}
          </select></label>
        <label className="faq-check"><input type="checkbox" checked={form.suggested} onChange={event => set('suggested', event.target.checked)} />{text('يظهر في الأسئلة المقترحة', 'Show among suggested questions')}</label>
      </div>
      {save.isError && <p className="field-error" role="alert">{errorMessage(save.error, text)}</p>}
    </div>
  </Dialog>;
}

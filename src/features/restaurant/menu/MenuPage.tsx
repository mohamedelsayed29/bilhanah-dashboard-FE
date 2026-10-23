import { useState } from 'react';
import { ArrowSquareOutIcon, BowlFoodIcon, PlusIcon } from '@phosphor-icons/react';
import type { OwnerMenuCategory, OwnerMenuItem } from '@bilhanah/contracts';
import { ErrorPanel } from '../../../components/ErrorBoundary';
import { PageHeader } from '../../../components/PageHeader';
import { PageSkeleton } from '../../../components/Skeleton';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { AccessNoticeCompact } from './AccessNoticeCompact';
import { CategoryCard } from './CategoryCard';
import { CategoryDialog } from './CategoryDialog';
import { ItemEditor } from './ItemEditor';
import { useMenuMutations } from './menu-mutations';
import { SortableList } from './Sortable';
import { useMenuQuery, useRestaurant } from '../queries';

type Editing =
  | { kind: 'category'; category?: OwnerMenuCategory; initialName?: { ar: string; en: string } }
  | { kind: 'item'; item?: OwnerMenuItem; categoryId: string }
  | null;

const SUGGESTIONS = [
  { ar: 'فطار', en: 'Breakfast' },
  { ar: 'سندوتشات', en: 'Sandwiches' },
  { ar: 'مشويات', en: 'Grills' },
  { ar: 'مشروبات', en: 'Drinks' },
  { ar: 'حلويات', en: 'Desserts' },
];

export function MenuPage() {
  const { text, count } = useLanguage();
  usePageTitle('المنيو', 'Menu');
  const restaurant = useRestaurant();
  const menu = useMenuQuery();
  const { reorderCategories } = useMenuMutations();
  const [editing, setEditing] = useState<Editing>(null);

  if (menu.isPending) return <PageSkeleton blocks={3} />;
  if (menu.isError) return <ErrorPanel error={menu.error} onRetry={() => void menu.refetch()} />;
  const { categories } = menu.data;
  const itemCount = categories.reduce((sum, category) => sum + category.items.length, 0);
  const localName = (category: OwnerMenuCategory) => text(category.nameAr, category.nameEn ?? category.nameAr);

  return <div className="page">
    <PageHeader title={text('المنيو', 'Menu')}
      description={categories.length
        ? text(`${count(categories.length, 'category')} و${count(itemCount, 'item')}. اسحب من المقبض عشان ترتّب، ودوس على أي صنف عشان تعدّله.`, `${count(categories.length, 'category')}, ${count(itemCount, 'item')}. Drag a handle to reorder; tap an item to edit it.`)
        : text('ابدأ بأقسام المنيو، وبعدين أضف الأصناف والأسعار.', 'Start with your menu sections, then add dishes and prices.')}
      actions={<>
        <a className="button button-secondary" href={restaurant.publicUrl} target="_blank" rel="noreferrer"><ArrowSquareOutIcon size={18} aria-hidden="true" />{text('معاينة', 'Preview')}</a>
        <button type="button" className="button button-primary" onClick={() => setEditing({ kind: 'category' })}><PlusIcon size={18} weight="bold" aria-hidden="true" />{text('قسم جديد', 'New category')}</button>
      </>} />
    <AccessNoticeCompact access={restaurant.access} />
    {categories.length === 0
      ? <section className="card empty-state menu-empty">
          <span className="empty-state-icon" aria-hidden="true"><BowlFoodIcon size={32} /></span>
          <h2>{text('المنيو لسه فاضي', 'Your menu is empty')}</h2>
          <p>{text('أضف أول قسم، زي "مشويات" أو "مشروبات". تقدر تختار واحد من دول:', 'Add your first category, like “Grills” or “Drinks”. Pick one to start:')}</p>
          <div className="chips">
            {SUGGESTIONS.map(suggestion => <button type="button" className="chip" key={suggestion.ar} onClick={() => setEditing({ kind: 'category', initialName: suggestion })}>
              <PlusIcon size={14} weight="bold" aria-hidden="true" />{text(suggestion.ar, suggestion.en)}
            </button>)}
          </div>
          <button type="button" className="button button-primary" onClick={() => setEditing({ kind: 'category' })}><PlusIcon size={18} weight="bold" aria-hidden="true" />{text('أضف قسم', 'Add a category')}</button>
        </section>
      : <SortableList items={categories} nameOf={localName} onReorder={ids => reorderCategories.mutate(ids)}>
          <ol className="category-list" aria-label={text('أقسام المنيو', 'Menu categories')}>
            {categories.map(category => <CategoryCard key={category.id} category={category}
              onRename={() => setEditing({ kind: 'category', category })}
              onAddItem={() => setEditing({ kind: 'item', categoryId: category.id })}
              onEditItem={item => setEditing({ kind: 'item', item, categoryId: category.id })} />)}
          </ol>
        </SortableList>}
    {categories.length > 0 && <button type="button" className="button button-secondary add-category" onClick={() => setEditing({ kind: 'category' })}>
      <PlusIcon size={18} weight="bold" aria-hidden="true" />{text('أضف قسم تاني', 'Add another category')}
    </button>}
    {editing?.kind === 'category' && <CategoryDialog category={editing.category} initialName={editing.initialName} onClose={() => setEditing(null)} />}
    {editing?.kind === 'item' && <ItemEditor item={editing.item} categoryId={editing.categoryId} categories={categories} onClose={() => setEditing(null)} />}
  </div>;
}

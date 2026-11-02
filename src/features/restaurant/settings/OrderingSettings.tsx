import { Link } from 'react-router';
import { ArmchairIcon, BagIcon } from '@phosphor-icons/react';
import type { OrderingSettings as Ordering } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Switch } from '../../../components/Switch';
import { errorMessage } from '../../../lib/api/error-messages';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useBranchList } from '../../branches/workspace';
import { useRestaurant } from '../queries';
import { PerBranchNotice } from './PerBranchNotice';
import { useSaveRestaurant } from './useSaveRestaurant';

export type OrderingPatch = Partial<Record<'orderingEnabled' | 'acceptsDineIn' | 'acceptsPickup' | 'ordersPaused', boolean>>;

/** Ordering on/off, dine-in and pickup, and what diners see. Each switch saves right away. */
export function OrderingSettings() {
  const { text } = useLanguage();
  usePageTitle('الطلبات', 'Ordering');
  const restaurant = useRestaurant();
  const list = useBranchList();
  const save = useSaveRestaurant();
  if (list.branches.filter(branch => branch.isActive).length > 1) return <PerBranchNotice kind="ordering" />;
  return <div className="settings-grid ordering-settings">
    <div className="settings-main">
      <OrderingSwitches ordering={restaurant.ordering} busy={save.isPending} error={save.isError ? save.error : null} onChange={patch => save.mutate(patch)} owner tablesPath="/tables" />
    </div>
    <aside className="settings-aside" aria-labelledby="diners-title">
      <h2 id="diners-title">{text('الزبون هيشوف إيه؟', 'What diners see')}</h2>
      <ul className="tips">
        <li>{text('زرار «أضف للطلب» جنب كل صنف متاح، وسلة فيها الإجمالي.', 'An “Add” button on every available dish and a basket with the total.')}</li>
        <li>{text('الصالة: بيختار طاولته (أو بتتحدد من الكود). التيك أواي: بيكتب اسمه ورقمه.', 'Dine-in: the table comes from the code (or they pick it). Pickup: they enter a name and phone number.')}</li>
        <li>{text('بعد الطلب بيتابع حالته لحظة بلحظة: اتقبل، بيتحضّر، جاهز.', 'After ordering they follow its status live: accepted, preparing, ready.')}</li>
        <li>{text('لو وقّفت الطلبات مؤقتًا أو المطعم مقفول حسب المواعيد، بيشوف المنيو بس.', 'While orders are paused or you are closed (opening hours), they see the menu only.')}</li>
        <li>{text('الأصناف اللي خلصت مش بتتطلب.', 'Sold-out dishes cannot be ordered.')}</li>
      </ul>
    </aside>
  </div>;
}

/**
 * The ordering switches (on/off, dine-in, pickup) for the restaurant or one branch.
 * `owner`: offers the plans page when ordering is not part of the plan.
 */
export function OrderingSwitches({ ordering, busy, error, onChange, owner, tablesPath }: {
  ordering: Ordering; busy: boolean; error: unknown; onChange: (patch: OrderingPatch) => void; owner: boolean; tablesPath: string;
}) {
  const { text } = useLanguage();
  const locked = !ordering.included;
  const types = [
    { key: 'acceptsDineIn' as const, checked: ordering.acceptsDineIn, icon: ArmchairIcon, label: text('طلبات الصالة', 'Dine-in'), hint: text('الزبون يمسح كود الطاولة ويطلب، والطلب يوصلك عليه اسم الطاولة.', 'Diners scan the table’s code and order; you see the table name on the order.') },
    { key: 'acceptsPickup' as const, checked: ordering.acceptsPickup, icon: BagIcon, label: text('تيك أواي', 'Pickup'), hint: text('الزبون يطلب ويسيب اسمه ورقم موبايله، ويستلم من المطعم.', 'Diners order with their name and phone number and collect at the counter.') },
  ];
  const onlyOne = types.filter(type => type.checked).length === 1;

  return <>
      {error != null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
      {locked && <Alert kind="info" live={false} title={text('الطلبات مش ضمن باقتك', 'Ordering is not part of your plan')}
        actions={owner ? <Link className="button button-primary button-small" to="/subscription">{text('شوف الباقات', 'See plans')}</Link> : undefined}>
        {text('باقة «منيو» فيها المنيو بس. اشترك في «منيو وطلبات» عشان الزباين يطلبوا من موبايلهم.', 'The “Menu” plan includes the menu only. Choose “Menu & Orders” to let diners order from their phones.')}
      </Alert>}
      <section className={`section ${locked ? 'is-locked' : ''}`} aria-labelledby="ordering-title">
        <div className="section-head"><div>
          <h2 id="ordering-title">{text('الطلب من المنيو', 'Ordering from your menu')}</h2>
          <p>{text('لما تشغّلها، الزبون يقدر يختار الأصناف من المنيو ويبعت الطلب، ويوصلك على لوحة الطلبات لحظتها.', 'When on, diners pick dishes on your menu and send the order; it reaches your order board instantly.')}</p>
        </div></div>
        <Switch checked={ordering.enabled} disabled={locked || busy} onChange={orderingEnabled => onChange({ orderingEnabled })}
          label={text('استقبل طلبات', 'Take orders')}
          description={ordering.enabled ? text('شغالة: الزباين شايفين زرار الطلب.', 'On: diners see the order button.') : text('مقفولة: الزباين شايفين المنيو بس.', 'Off: diners see the menu only.')} />
      </section>
      <section className="section" aria-labelledby="types-title">
        <div className="section-head"><div><h2 id="types-title">{text('أنواع الطلبات', 'Order types')}</h2><p>{text('اختار نوع واحد على الأقل.', 'Choose at least one.')}</p></div></div>
        <div className="order-types">
          {types.map(type => <label key={type.key} className={`order-type ${type.checked ? 'is-checked' : ''}`}>
            <input type="checkbox" checked={type.checked} disabled={locked || busy || (type.checked && onlyOne)}
              onChange={event => onChange({ [type.key]: event.target.checked })} />
            <span><strong>{type.label}</strong><small>{type.hint}</small></span>
          </label>)}
        </div>
        {ordering.acceptsDineIn && <p className="muted ordering-tables-hint">{text('لطلبات الصالة، ضيف طاولاتك واطبع كود لكل طاولة:', 'For dine-in, add your tables and print a code for each:')} <Link className="link-action" to={tablesPath}>{text('الطاولات', 'Tables')}</Link></p>}
      </section>
  </>;
}

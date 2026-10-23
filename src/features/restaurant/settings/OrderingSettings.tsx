import { Link } from 'react-router';
import { ArmchairIcon, BagIcon, LockIcon, QrCodeIcon } from '@phosphor-icons/react';
import { Alert } from '../../../components/Alert';
import { Switch } from '../../../components/Switch';
import { errorMessage } from '../../../lib/api/error-messages';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useRestaurant } from '../queries';
import { useSaveRestaurant } from './useSaveRestaurant';

/** Ordering on/off, dine-in and pickup, and what diners see. Each switch saves right away. */
export function OrderingSettings() {
  const { text } = useLanguage();
  usePageTitle('الطلبات', 'Ordering');
  const restaurant = useRestaurant();
  const save = useSaveRestaurant();
  const { ordering } = restaurant;
  const locked = !ordering.included;
  const busy = save.isPending;
  const types = [
    { key: 'acceptsDineIn' as const, checked: ordering.acceptsDineIn, icon: ArmchairIcon, label: text('طلبات الصالة', 'Dine-in'), hint: text('الزبون يمسح كود الطاولة ويطلب، والطلب يوصلك عليه اسم الطاولة.', 'Diners scan the table’s code and order; you see the table name on the order.') },
    { key: 'acceptsPickup' as const, checked: ordering.acceptsPickup, icon: BagIcon, label: text('تيك أواي', 'Pickup'), hint: text('الزبون يطلب ويسيب اسمه ورقم موبايله، ويستلم من المطعم.', 'Diners order with their name and phone number and collect at the counter.') },
  ];
  const onlyOne = types.filter(type => type.checked).length === 1;

  return <div className="settings-grid ordering-settings">
    <div className="form">
      {save.isError && <Alert kind="error">{errorMessage(save.error, text)}</Alert>}
      {locked && <Alert kind="info" live={false} title={text('الطلبات مش ضمن باقتك', 'Ordering is not part of your plan')}
        actions={<Link className="button button-primary button-small" to="/subscription">{text('شوف الباقات', 'See plans')}</Link>}>
        {text('باقة «منيو» فيها المنيو بس. اشترك في «منيو وطلبات» عشان الزباين يطلبوا من موبايلهم.', 'The “Menu” plan includes the menu only. Choose “Menu & Orders” to let diners order from their phones.')}
      </Alert>}
      <section className={`card card-padded ${locked ? 'is-locked' : ''}`} aria-labelledby="ordering-title">
        <div className="card-header"><div>
          <h2 id="ordering-title">{locked && <LockIcon size={18} aria-hidden="true" />} {text('الطلب من المنيو', 'Ordering from your menu')}</h2>
          <p>{text('لما تشغّلها، الزبون يقدر يختار الأصناف من المنيو ويبعت الطلب، ويوصلك على لوحة الطلبات لحظتها.', 'When on, diners pick dishes on your menu and send the order; it reaches your order board instantly.')}</p>
        </div></div>
        <Switch checked={ordering.enabled} disabled={locked || busy} onChange={orderingEnabled => save.mutate({ orderingEnabled })}
          label={text('استقبل طلبات', 'Take orders')}
          description={ordering.enabled ? text('شغالة: الزباين شايفين زرار الطلب.', 'On: diners see the order button.') : text('مقفولة: الزباين شايفين المنيو بس.', 'Off: diners see the menu only.')} />
      </section>
      <section className="card card-padded" aria-labelledby="types-title">
        <div className="card-header"><div>
          <h2 id="types-title">{text('أنواع الطلبات', 'Order types')}</h2>
          <p>{text('اختار نوع واحد على الأقل.', 'Choose at least one.')}</p>
        </div></div>
        <div className="order-types">
          {types.map(type => <label key={type.key} className={`order-type ${type.checked ? 'is-checked' : ''}`}>
            <input type="checkbox" checked={type.checked} disabled={locked || busy || (type.checked && onlyOne)}
              onChange={event => save.mutate({ [type.key]: event.target.checked })} />
            <span className="order-type-icon" aria-hidden="true"><type.icon size={22} weight="bold" /></span>
            <span><strong>{type.label}</strong><small>{type.hint}</small></span>
          </label>)}
        </div>
        {ordering.acceptsDineIn && <p className="muted small ordering-tables-hint"><QrCodeIcon size={16} aria-hidden="true" /> {text('لطلبات الصالة، ضيف طاولاتك واطبع كود لكل طاولة.', 'For dine-in, add your tables and print a code for each.')} <Link className="link" to="/tables">{text('الطاولات', 'Tables')}</Link></p>}
      </section>
    </div>
    <aside className="card card-padded tips-card" aria-labelledby="diners-title">
      <div className="card-header"><h2 id="diners-title">{text('الزبون هيشوف إيه؟', 'What diners see')}</h2></div>
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

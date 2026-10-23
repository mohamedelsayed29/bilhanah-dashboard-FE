import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowSquareOutIcon, CheckCircleIcon, CircleIcon, ClockIcon, ForkKnifeIcon, ImageSquareIcon, LinkIcon, PaletteIcon, PencilSimpleLineIcon,
  QrCodeIcon, SealCheckIcon,
} from '@phosphor-icons/react';
import type { OwnerMenu, OwnerRestaurant } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { CopyButton } from '../../../components/CopyButton';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { formatDate } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useSession } from '../../../lib/session';
import { accessDaysLeft, AccessBadge, PLAN_NAMES } from '../access';
import { useMenuQuery, useRestaurant } from '../queries';

export function OverviewPage() {
  const { text } = useLanguage();
  usePageTitle('الرئيسية', 'Overview');
  const restaurant = useRestaurant();
  const session = useSession();
  const menu = useMenuQuery();
  const firstName = session.status === 'authenticated' ? session.user.fullName.split(' ')[0] : '';
  return <div className="page">
    <PageHeader eyebrow={text(`أهلًا يا ${firstName} 👋`, `Welcome, ${firstName} 👋`)} title={restaurant.name}
      description={text('ده ملخص مطعمك على بالهنا.', 'Here is your restaurant at a glance.')}
      actions={<>
        <a className="button button-secondary" href={restaurant.publicUrl} target="_blank" rel="noreferrer"><ArrowSquareOutIcon size={18} aria-hidden="true" />{text('معاينة المنيو', 'Preview menu')}</a>
        <Link className="button button-primary" to="/menu"><PencilSimpleLineIcon size={18} aria-hidden="true" />{text('عدّل المنيو', 'Edit menu')}</Link>
      </>} />
    <AccessNotice restaurant={restaurant} />
    <div className="overview-grid">
      <LinkCard restaurant={restaurant} />
      <PlanCard restaurant={restaurant} />
    </div>
    <section aria-labelledby="stats-title">
      <h2 id="stats-title" className="visually-hidden">{text('إحصائيات المنيو', 'Menu statistics')}</h2>
      {menu.data ? <MenuStats menu={menu.data} /> : <div className="stats-grid">{[0, 1, 2, 3].map(index => <div className="stat card" key={index}><Skeleton width={60} height={28} /><Skeleton width={90} height={14} /></div>)}</div>}
    </section>
    <div className="overview-grid">
      {menu.data && <Checklist restaurant={restaurant} menu={menu.data} />}
      <QuickLinks />
    </div>
  </div>;
}

function AccessNotice({ restaurant }: { restaurant: OwnerRestaurant }) {
  const { text } = useLanguage();
  if (restaurant.access.status === 'INACTIVE') {
    return <Alert kind="warning" live={false} title={text('المنيو العام متوقف مؤقتًا', 'Your public menu is paused')}>
      {text('اشتراكك مش فعّال دلوقتي، فالزباين بيشوفوا إن المنيو "مش متاح مؤقتًا". تقدر تكمّل تعديل المنيو عادي، وكل حاجة هترجع تظهر أول ما الاشتراك يتفعّل.',
        'Your subscription isn’t active, so diners see the menu as “temporarily unavailable”. You can keep editing; everything goes live again as soon as your subscription is active.')}
    </Alert>;
  }
  if (restaurant.access.status === 'SUSPENDED') {
    return <Alert kind="error" live={false} title={text('المطعم موقوف', 'Your restaurant is suspended')}>
      {text('المنيو العام مش ظاهر والتعديل متوقف. تواصل مع دعم بالهنا.', 'The public menu is hidden and editing is paused. Please contact Bilhanah support.')}
    </Alert>;
  }
  return null;
}

function LinkCard({ restaurant }: { restaurant: OwnerRestaurant }) {
  const { text } = useLanguage();
  return <section className="card card-padded link-card" aria-labelledby="link-title">
    <div className="link-card-body">
      <span className="eyebrow"><LinkIcon size={16} aria-hidden="true" />{text('لينك المنيو', 'Menu link')}</span>
      <h2 id="link-title" className="section-title">{text('شارك المنيو مع زباينك', 'Share your menu with diners')}</h2>
      <a className="public-url ltr" href={restaurant.publicUrl} target="_blank" rel="noreferrer">{restaurant.publicUrl.replace(/^https?:\/\//, '')}</a>
      <div className="form-actions">
        <CopyButton value={restaurant.publicUrl} label={text('انسخ اللينك', 'Copy link')} />
        <a className="button button-ghost button-small" href={restaurant.publicUrl} target="_blank" rel="noreferrer"><ArrowSquareOutIcon size={17} aria-hidden="true" />{text('افتح', 'Open')}</a>
      </div>
    </div>
    <Link to="/qr-codes" className="link-card-qr">
      <QRCodeSVG value={restaurant.publicUrl} size={104} fgColor="#04352f" bgColor="#ffffff" marginSize={2} aria-hidden="true" />
      <span>{text('QR للطباعة', 'Print QR')}</span>
    </Link>
  </section>;
}

function PlanCard({ restaurant }: { restaurant: OwnerRestaurant }) {
  const { text, number, language } = useLanguage();
  const { access } = restaurant;
  const days = accessDaysLeft(access);
  const end = access.status === 'TRIAL' ? access.trialEndsAt : access.currentPeriodEndsAt;
  const total = access.trialEndsAt ? Math.max(1, Math.round((new Date(access.trialEndsAt).getTime() - new Date(restaurant.createdAt).getTime()) / 86_400_000)) : 30;
  return <section className="card card-padded plan-card" aria-labelledby="plan-title">
    <span className="eyebrow"><SealCheckIcon size={16} aria-hidden="true" />{text('الاشتراك', 'Subscription')}</span>
    <div className="plan-card-head">
      <h2 id="plan-title" className="section-title">{access.planCode ? text(PLAN_NAMES[access.planCode][0], PLAN_NAMES[access.planCode][1]) : text('من غير باقة', 'No plan')}</h2>
      <AccessBadge access={access} />
    </div>
    {access.status === 'TRIAL' && days !== null && <>
      <p className="plan-days"><strong>{number(days)}</strong> {text(days === 1 ? 'يوم فاضل في التجربة' : 'يوم فاضلين في التجربة', days === 1 ? 'day left in your trial' : 'days left in your trial')}</p>
      <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={days} aria-label={text('الأيام المتبقية', 'Days remaining')}><span style={{ width: `${Math.min(100, (days / total) * 100)}%` }} /></div>
    </>}
    {end && <p className="muted plan-end">{access.status === 'TRIAL' ? text('التجربة بتنتهي يوم', 'Trial ends on') : text('الاشتراك ساري لحد', 'Active until')} {formatDate(end, language, { dateStyle: 'long' })}</p>}
    {access.status === 'INACTIVE' && <p className="muted">{text('التعديل متاح، والمنيو هيرجع يظهر أول ما تشترك.', 'Editing is available; your menu goes live again once you subscribe.')}</p>}
    <p className="plan-footnote"><Link className="link" to="/subscription">{access.status === 'PAID' ? text('جدّد اشتراكك', 'Renew your subscription') : text('ادفع واشترك', 'Pay and subscribe')}</Link> · {text('إنستاباي أو فودافون كاش أو تحويل بنكي', 'InstaPay, Vodafone Cash or bank transfer')}</p>
  </section>;
}

export function menuStats(menu: OwnerMenu) {
  const items = menu.categories.flatMap(category => category.items);
  return {
    categories: menu.categories.length,
    items: items.length,
    soldOut: items.filter(item => !item.isAvailable).length,
    hidden: items.filter(item => !item.isVisible).length + menu.categories.filter(category => !category.isVisible).length,
    withPhotos: items.filter(item => item.image).length,
  };
}

function MenuStats({ menu }: { menu: OwnerMenu }) {
  const { text, number } = useLanguage();
  const stats = menuStats(menu);
  const tiles = [
    { value: stats.categories, label: text('قسم', 'Categories'), tone: '' },
    { value: stats.items, label: text('صنف', 'Items'), tone: '' },
    { value: stats.soldOut, label: text('خلصان', 'Sold out'), tone: stats.soldOut ? 'stat-warning' : '' },
    { value: stats.hidden, label: text('مخفي', 'Hidden'), tone: '' },
  ];
  return <div className="stats-grid">
    {tiles.map(tile => <Link to="/menu" className={`stat card ${tile.tone}`} key={tile.label} data-testid={`stat-${tile.label}`}>
      <strong>{number(tile.value)}</strong><span>{tile.label}</span>
    </Link>)}
  </div>;
}

function Checklist({ restaurant, menu }: { restaurant: OwnerRestaurant; menu: OwnerMenu }) {
  const { text } = useLanguage();
  const stats = menuStats(menu);
  const steps = [
    { done: stats.categories > 0, to: '/menu', label: text('أضف أول قسم في المنيو', 'Add your first menu category') },
    { done: stats.items >= 3, to: '/menu', label: text('أضف ٣ أصناف على الأقل', 'Add at least 3 items') },
    { done: stats.withPhotos > 0, to: '/menu', label: text('أضف صور للأصناف', 'Add photos to your dishes') },
    { done: !!restaurant.logo, to: '/settings/branding', label: text('ارفع لوجو المطعم', 'Upload your logo') },
    { done: !!restaurant.openingHours, to: '/settings/hours', label: text('حدد مواعيد الشغل', 'Set your opening hours') },
  ];
  const remaining = steps.filter(step => !step.done).length;
  if (remaining === 0) return null;
  return <section className="card card-padded" aria-labelledby="checklist-title">
    <div className="card-header"><div>
      <h2 id="checklist-title">{text('جهّز منيو مطعمك', 'Get your menu ready')}</h2>
      <p>{text(`فاضل ${remaining} خطوات بسيطة.`, `${remaining} quick step${remaining === 1 ? '' : 's'} left.`)}</p>
    </div></div>
    <ul className="checklist">
      {steps.map(step => <li key={step.label} className={step.done ? 'done' : ''}>
        {step.done ? <CheckCircleIcon size={22} weight="fill" aria-hidden="true" /> : <CircleIcon size={22} aria-hidden="true" />}
        {step.done ? <span>{step.label}<span className="visually-hidden"> ({text('تم', 'done')})</span></span> : <Link to={step.to} className="link">{step.label}</Link>}
      </li>)}
    </ul>
  </section>;
}

function QuickLinks() {
  const { text } = useLanguage();
  const links = [
    { to: '/menu', icon: ForkKnifeIcon, title: text('الأصناف والأسعار', 'Items & prices'), body: text('أضف وعدّل ورتّب', 'Add, edit and reorder') },
    { to: '/qr-codes', icon: QrCodeIcon, title: text('كود QR', 'QR code'), body: text('نزّله واطبعه', 'Download and print') },
    { to: '/settings/branding', icon: PaletteIcon, title: text('الشكل والألوان', 'Branding'), body: text('لوجو وغلاف ولون', 'Logo, cover and color') },
    { to: '/settings/hours', icon: ClockIcon, title: text('مواعيد الشغل', 'Opening hours'), body: text('أيام وساعات الفتح', 'Days and hours') },
    { to: '/settings', icon: ImageSquareIcon, title: text('بيانات المطعم', 'Restaurant profile'), body: text('تليفون وعنوان وسوشيال', 'Phone, address, social') },
  ];
  return <section className="card card-padded" aria-labelledby="quick-title">
    <div className="card-header"><h2 id="quick-title">{text('اختصارات', 'Quick links')}</h2></div>
    <ul className="quick-links">
      {links.map(link => <li key={link.to}><Link to={link.to}>
        <span className="quick-icon" aria-hidden="true"><link.icon size={20} /></span>
        <span><strong>{link.title}</strong><small>{link.body}</small></span>
      </Link></li>)}
    </ul>
  </section>;
}

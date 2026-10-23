import { useState } from 'react';
import { ArrowCounterClockwiseIcon, ClockIcon, MapPinIcon } from '@phosphor-icons/react';
import type { ImageSet } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Field } from '../../../components/Field';
import { ImageUpload } from '../../../components/ImageUpload';
import { errorMessage } from '../../../lib/api/error-messages';
import { formatPrice } from '../../../lib/format';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useRestaurant } from '../queries';
import { HEX_COLOR, readableTextOn } from './color';
import { useSaveRestaurant } from './useSaveRestaurant';

const DEFAULT_COLOR = '#075e54';
const PRESETS = ['#075e54', '#0f5c4c', '#1d4ed8', '#7c2d12', '#b91c1c', '#c2410c', '#a16207', '#6d28d9', '#be185d', '#242b29'];

export function BrandingSettings() {
  const { text, language } = useLanguage();
  usePageTitle('الشكل والألوان', 'Branding');
  const restaurant = useRestaurant();
  const save = useSaveRestaurant();
  const [logo, setLogo] = useState<ImageSet | null>(restaurant.logo);
  const [cover, setCover] = useState<ImageSet | null>(restaurant.cover);
  const [color, setColor] = useState<string | null>(restaurant.brandColor);
  const [hexInput, setHexInput] = useState(restaurant.brandColor ?? DEFAULT_COLOR);
  const [uploading, setUploading] = useState({ logo: false, cover: false });
  const hexValid = HEX_COLOR.test(hexInput);
  const dirty = logo?.id !== restaurant.logo?.id || cover?.id !== restaurant.cover?.id || (color ?? null) !== (restaurant.brandColor ?? null);
  const accent = color ?? DEFAULT_COLOR;
  const onAccent = readableTextOn(accent);

  const pick = (value: string) => { setColor(value.toLowerCase()); setHexInput(value.toLowerCase()); };
  const submit = () => {
    if (!hexValid) return;
    save.mutate({ logoId: logo?.id ?? null, coverId: cover?.id ?? null, brandColor: color });
  };

  return <div className="branding-layout">
    <form className="settings-main" noValidate onSubmit={event => { event.preventDefault(); submit(); }}>
      {save.isError && <Alert kind="error">{errorMessage(save.error, text)}</Alert>}
      <section className="section" aria-labelledby="images-title">
        <div className="section-head"><div><h2 id="images-title">{text('اللوجو وصورة الغلاف', 'Logo and cover photo')}</h2><p>{text('اللوجو بيظهر جنب اسم المطعم، والغلاف في أول المنيو.', 'Your logo appears next to the restaurant name; the cover sits at the top of the menu.')}</p></div></div>
        <div className="branding-uploads">
          <ImageUpload kind="LOGO" value={logo} onChange={setLogo} aspect="1 / 1" label={text('اللوجو', 'Logo')} hint={text('مربع، ٤٠٠ بكسل أو أكبر.', 'Square, 400 px or larger.')}
            onBusyChange={busy => setUploading(current => ({ ...current, logo: busy }))} />
          <ImageUpload kind="COVER" value={cover} onChange={setCover} aspect="16 / 7" label={text('صورة الغلاف', 'Cover photo')} hint={text('عريضة، ١٦٠٠×٧٠٠ بكسل مثالية.', 'Wide; 1600×700 px is ideal.')}
            onBusyChange={busy => setUploading(current => ({ ...current, cover: busy }))} />
        </div>
      </section>
      <section className="section" aria-labelledby="color-title">
        <div className="section-head"><div><h2 id="color-title">{text('لون المطعم', 'Brand color')}</h2><p>{text('بيتلوّن بيه الأزرار والأقسام في المنيو.', 'Used for buttons and highlights on your menu.')}</p></div></div>
        <div className="color-row">
          <label className="color-picker" style={{ background: accent }}>
            <span className="visually-hidden">{text('اختار لون', 'Pick a color')}</span>
            <input type="color" value={accent} onChange={event => pick(event.target.value)} />
          </label>
          <Field label={text('كود اللون (hex)', 'Hex code')} error={hexValid ? undefined : { message: 'Use a hex color such as #0f5c4c.' }}>
            <input className="input hex-input" dir="ltr" maxLength={7} value={hexInput} spellCheck={false}
              onChange={event => {
                const value = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`;
                setHexInput(value);
                if (HEX_COLOR.test(value)) setColor(value.toLowerCase());
              }} />
          </Field>
          {color && <Button variant="ghost" small onClick={() => { setColor(null); setHexInput(DEFAULT_COLOR); }} icon={<ArrowCounterClockwiseIcon size={16} aria-hidden="true" />}>{text('اللون الافتراضي', 'Default color')}</Button>}
        </div>
        <div className="swatches" role="group" aria-label={text('ألوان مقترحة', 'Suggested colors')}>
          {PRESETS.map(preset => <button type="button" key={preset} className="swatch-button" style={{ background: preset }} aria-label={preset} aria-pressed={accent === preset} onClick={() => pick(preset)} />)}
        </div>
      </section>
      <div className={`sticky-actions ${dirty ? 'is-dirty' : ''}`}>
        {dirty && <span className="muted">{text('في تغييرات مش محفوظة', 'You have unsaved changes')}</span>}
        <Button variant="secondary" disabled={!dirty || save.isPending} onClick={() => { setLogo(restaurant.logo); setCover(restaurant.cover); setColor(restaurant.brandColor); setHexInput(restaurant.brandColor ?? DEFAULT_COLOR); }}>{text('تراجع', 'Discard')}</Button>
        <Button type="submit" loading={save.isPending} disabled={!dirty || !hexValid || uploading.logo || uploading.cover}>{text('احفظ الشكل', 'Save branding')}</Button>
      </div>
    </form>

    <aside className="preview-panel" aria-labelledby="preview-title">
      <h2 id="preview-title">{text('الزبون هيشوف كده', 'What diners see')}</h2>
      <div className="phone-preview" style={{ ['--accent' as string]: accent, ['--on-accent' as string]: onAccent }}>
        <div className="phone-cover">{cover ? <img src={cover.url} alt="" /> : <span className="phone-cover-empty" />}</div>
        <div className="phone-head">
          <span className="phone-logo">{logo ? <img src={logo.url} alt="" /> : restaurant.name.charAt(0)}</span>
          <div><strong>{restaurant.name}</strong><small><ClockIcon size={12} aria-hidden="true" /> {text('مفتوح دلوقتي', 'Open now')} · <MapPinIcon size={12} aria-hidden="true" /> {restaurant.city}</small></div>
        </div>
        <div className="phone-tabs"><span className="active">{text('الأكثر طلبًا', 'Popular')}</span><span>{text('مشويات', 'Grills')}</span><span>{text('مشروبات', 'Drinks')}</span></div>
        {[{ ar: 'كفتة مشوية', en: 'Grilled kofta', price: 14500 }, { ar: 'فراخ بالليمون', en: 'Lemon chicken', price: 12000 }].map(dish => <div className="phone-dish" key={dish.ar}>
          <div><strong>{text(dish.ar, dish.en)}</strong><small>{text('مع عيش بلدي وسلطة', 'With baladi bread and salad')}</small><span className="phone-price">{formatPrice(dish.price, language)}</span></div>
          <span className="phone-add" aria-hidden="true">+</span>
        </div>)}
        <div className="phone-button">{text('كلّمنا واتساب', 'Message us on WhatsApp')}</div>
      </div>
    </aside>
  </div>;
}

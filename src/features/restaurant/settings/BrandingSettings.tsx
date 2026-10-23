import { useState } from 'react';
import { ArrowCounterClockwiseIcon, ArrowSquareOutIcon } from '@phosphor-icons/react';
import { type ImageSet, MENU_THEME_INFO, MENU_THEMES, type MenuTheme } from '@bilhanah/contracts';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Field } from '../../../components/Field';
import { ImageUpload } from '../../../components/ImageUpload';
import { errorMessage } from '../../../lib/api/error-messages';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useRestaurant } from '../queries';
import { HEX_COLOR } from './color';
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
  const [theme, setTheme] = useState<MenuTheme>(restaurant.menuTheme);
  // Reloads the live preview after saving, so it shows the saved logo, cover and colour.
  const [previewVersion, setPreviewVersion] = useState(0);
  const [hexInput, setHexInput] = useState(restaurant.brandColor ?? DEFAULT_COLOR);
  const [uploading, setUploading] = useState({ logo: false, cover: false });
  const hexValid = HEX_COLOR.test(hexInput);
  const dirty = logo?.id !== restaurant.logo?.id || cover?.id !== restaurant.cover?.id || (color ?? null) !== (restaurant.brandColor ?? null) || theme !== restaurant.menuTheme;
  const accent = color ?? DEFAULT_COLOR;
  const previewUrl = `${restaurant.publicUrl}/?preview-theme=${theme}&v=${previewVersion}`;

  const pick = (value: string) => { setColor(value.toLowerCase()); setHexInput(value.toLowerCase()); };
  const submit = () => {
    if (!hexValid) return;
    save.mutate({ logoId: logo?.id ?? null, coverId: cover?.id ?? null, brandColor: color, menuTheme: theme }, { onSuccess: () => setPreviewVersion(version => version + 1) });
  };

  return <div className="branding-layout">
    <form className="settings-main" noValidate onSubmit={event => { event.preventDefault(); submit(); }}>
      {save.isError && <Alert kind="error">{errorMessage(save.error, text)}</Alert>}
      <section className="section" aria-labelledby="theme-title">
        <div className="section-head"><div><h2 id="theme-title">{text('شكل المنيو', 'Menu theme')}</h2><p>{text('الشكل اللي الزبون بيشوف بيه المنيو والطلب ومتابعته.', 'How diners see your menu, their order and its tracking page.')}</p></div></div>
        <div className="theme-options" role="radiogroup" aria-labelledby="theme-title">
          {MENU_THEMES.map(id => <label key={id} className={`theme-option ${theme === id ? 'is-selected' : ''}`}>
            <input type="radio" name="menu-theme" value={id} checked={theme === id} onChange={() => setTheme(id)} />
            <span className={`theme-sample theme-sample-${id}`} aria-hidden="true"><span /><span /><span /></span>
            <span className="theme-option-text"><strong>{MENU_THEME_INFO[id].name[language]}</strong><small>{MENU_THEME_INFO[id].description[language]}</small></span>
          </label>)}
        </div>
      </section>
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
        <Button variant="secondary" disabled={!dirty || save.isPending} onClick={() => { setLogo(restaurant.logo); setCover(restaurant.cover); setColor(restaurant.brandColor); setHexInput(restaurant.brandColor ?? DEFAULT_COLOR); setTheme(restaurant.menuTheme); }}>{text('تراجع', 'Discard')}</Button>
        <Button type="submit" loading={save.isPending} disabled={!dirty || !hexValid || uploading.logo || uploading.cover}>{text('احفظ الشكل', 'Save branding')}</Button>
      </div>
    </form>

    <aside className="preview-panel" aria-labelledby="preview-title">
      <h2 id="preview-title">{text('الزبون هيشوف كده', 'What diners see')}</h2>
      <p className="muted">{text('منيوك الحقيقي بالشكل اللي اخترته. اللوجو والغلاف واللون بيظهروا هنا بعد الحفظ.', 'Your real menu in the theme you picked. Logo, cover and colour show here once saved.')}</p>
      {/* A picture of the menu: inert, so keyboard and screen-reader users aren't sent into a second copy of it; the link below opens it properly. */}
      <div className="live-preview" inert>
        <iframe key={previewUrl} src={previewUrl} title={text('معاينة المنيو', 'Menu preview')} loading="lazy" />
      </div>
      <a className="link preview-open" href={previewUrl} target="_blank" rel="noreferrer"><ArrowSquareOutIcon size={16} aria-hidden="true" /> {text('افتح المعاينة في صفحة', 'Open the preview in a tab')}</a>
    </aside>
  </div>;
}

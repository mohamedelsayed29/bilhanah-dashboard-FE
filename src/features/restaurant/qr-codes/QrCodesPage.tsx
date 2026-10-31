import { useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { ArrowSquareOutIcon, CheckIcon, DownloadSimpleIcon, FileSvgIcon, LinkSimpleIcon, PrinterIcon } from '@phosphor-icons/react';
import { CopyButton } from '../../../components/CopyButton';
import { PageHeader } from '../../../components/PageHeader';
import { useToast } from '../../../components/Toast';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useRestaurant } from '../queries';
import { menuQrUrl } from './qr-url';

const COLORS = [
  { id: 'black', value: '#111111', ar: 'أسود', en: 'Black' },
  { id: 'teal', value: '#04352f', ar: 'أخضر بالهنا', en: 'Bilhanah teal' },
] as const;

/** 1024 px PNG: about 8.7 cm at 300 dpi, sharp on table cards and posters. */
const PNG_SIZE = 1024;

function download(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

export function QrCodesPage() {
  const { text } = useLanguage();
  usePageTitle('كود QR', 'QR code');
  const restaurant = useRestaurant();
  const toast = useToast();
  const [color, setColor] = useState<(typeof COLORS)[number]['id']>('black');
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fg = COLORS.find(entry => entry.id === color)!.value;
  const filename = `bilhanah-${restaurant.subdomain}-qr`;

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(PNG_SIZE));
    clone.setAttribute('height', String(PNG_SIZE));
    clone.removeAttribute('aria-hidden');
    const source = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
    download(url, `${filename}.svg`);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(text('نزل ملف SVG', 'SVG downloaded'));
  };

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      download(url, `${filename}.png`);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(text('نزلت صورة PNG', 'PNG downloaded'));
    }, 'image/png');
  };

  const host = restaurant.publicUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  // Scans of this code count as "QR code" in the insights; the same link goes into every download.
  const qrUrl = menuQrUrl(restaurant.publicUrl);
  const tips = [
    text('خلّي الكود ٣ سم على الأقل، و٥ سم أحسن على الترابيزة.', 'Print the code at least 3 cm wide; 5 cm is better on tables.'),
    text('سيب مساحة بيضا حوالين الكود، ومتحطش عليه لوجو أو كلام.', 'Keep a white margin around the code and don’t print over it.'),
    text('استخدم ورق مط (مش لامع) عشان الإضاءة متعكسش عليه.', 'Use matte paper so lights don’t reflect off it.'),
    text('جرّب تمسح الكود بموبايلك قبل ما تطبع كمية كبيرة.', 'Scan a test print with your phone before printing many.'),
    text('الكود مش بيتغير لما تعدّل المنيو، فمش محتاج تطبع تاني.', 'The code never changes when you edit the menu, so you won’t need to reprint.'),
    text('لو طابع الكود قبل كده هيفضل شغال، بس مسحه بيتحسب «لينك» في الإحصائيات. اطبع الكود الجديد عشان يتحسب «كود QR».', 'Codes you printed earlier keep working, but their scans count as “link” in your insights. Print the new code to count them as QR scans.'),
  ];
  // The code on a deep-teal stage as it will look printed; downloads, the link and print tips beside it.
  return <div className="page qr-page">
    <PageHeader title={text('كود QR', 'QR code')} description={text('الزبون يوجّه كاميرا موبايله على الكود ويفتح المنيو على طول، من غير ما ينزّل أي تطبيق.', 'Diners point their phone camera at the code and your menu opens instantly, no app needed.')} />
    <div className="qr-layout">
      <section className="qr-stage" aria-labelledby="qr-title">
        <h2 id="qr-title" className="qr-stage-title">{text('معاينة الكارت', 'Card preview')}</h2>
        <div className="table-card" style={{ ['--qr-accent' as string]: restaurant.brandColor ?? '#075e54' }}>
          <strong className="table-card-name"><bdi>{restaurant.name}</bdi></strong>
          <span className="table-card-hint">{text('امسح الكود وشوف المنيو', 'Scan to see the menu')}</span>
          <div className="table-card-qr">
            <QRCodeSVG ref={svgRef} value={qrUrl} size={220} level="M" marginSize={2} fgColor={fg} bgColor="#ffffff"
              aria-label={text(`كود QR لمنيو ${restaurant.name}`, `QR code for the ${restaurant.name} menu`)} role="img" />
          </div>
          <span className="table-card-url ltr">{host}</span>
        </div>
        {/* Drawn off-screen at print size for the PNG download. */}
        <div hidden><QRCodeCanvas ref={canvasRef} value={qrUrl} size={PNG_SIZE} level="M" marginSize={4} fgColor={fg} bgColor="#ffffff" /></div>
        <fieldset className="qr-color">
          <legend className="qr-color-label">{text('لون الكود', 'Code color')}</legend>
          <div className="qr-swatches">
            {COLORS.map(entry => <label key={entry.id} className={`qr-swatch ${color === entry.id ? 'is-selected' : ''}`}>
              <input type="radio" name="qr-color" value={entry.id} checked={color === entry.id} onChange={() => setColor(entry.id)} className="visually-hidden" />
              <span className="swatch" style={{ background: entry.value }} aria-hidden="true" />{text(entry.ar, entry.en)}
            </label>)}
          </div>
        </fieldset>
      </section>

      <div className="qr-side">
        <section className="card qr-card" aria-labelledby="download-title">
          <header className="qr-card-head">
            <span className="qr-card-icon" aria-hidden="true"><DownloadSimpleIcon size={20} weight="bold" /></span>
            <div><h2 id="download-title">{text('نزّل الكود', 'Download')}</h2><p>{text('PNG للطباعة السريعة والسوشيال، وSVG للمطابع عشان يفضل حاد في أي مقاس.', 'PNG for quick printing and social media; SVG for print shops, sharp at any size.')}</p></div>
          </header>
          <div className="download-options">
            <button type="button" className="download-option is-primary" onClick={downloadPng}>
              <span className="download-option-icon" aria-hidden="true"><DownloadSimpleIcon size={22} weight="bold" /></span>
              <span><strong>{text('صورة PNG (١٠٢٤ بكسل)', 'PNG image (1024 px)')}</strong><small>{text('للطباعة العادية والسوشيال ميديا', 'Everyday printing and social media')}</small></span>
            </button>
            <button type="button" className="download-option" onClick={downloadSvg}>
              <span className="download-option-icon" aria-hidden="true"><FileSvgIcon size={22} weight="bold" /></span>
              <span><strong>{text('ملف SVG للطباعة', 'SVG for print')}</strong><small>{text('للمطابع، حاد في أي مقاس', 'For print shops, sharp at any size')}</small></span>
            </button>
          </div>
        </section>

        <section className="card qr-card" aria-labelledby="url-title">
          <header className="qr-card-head">
            <span className="qr-card-icon" aria-hidden="true"><LinkSimpleIcon size={20} weight="bold" /></span>
            <div><h2 id="url-title">{text('لينك المنيو', 'Your menu link')}</h2><p>{text('حطه في البايو أو ابعته واتساب.', 'Put it in your bio or send it on WhatsApp.')}</p></div>
          </header>
          <div className="qr-link-box">
            <p className="public-url ltr">{host}</p>
            <div className="qr-link-actions">
              <CopyButton value={restaurant.publicUrl} label={text('انسخ اللينك', 'Copy link')} />
              <a className="button button-ghost button-small" href={restaurant.publicUrl} target="_blank" rel="noreferrer"><ArrowSquareOutIcon size={17} aria-hidden="true" />{text('افتح المنيو', 'Open menu')}</a>
            </div>
          </div>
          <p className="qr-url-hint">{text('الكود فيه نفس اللينك وزيادة ‎?src=qr عشان مسح الكود يتحسب لوحده في الإحصائيات:', 'The code holds the same link plus ?src=qr, so scans are counted separately in your insights:')} <span className="ltr" data-testid="qr-url">{qrUrl}</span></p>
        </section>

        <section className="card qr-card" aria-labelledby="tips-title">
          <header className="qr-card-head">
            <span className="qr-card-icon" aria-hidden="true"><PrinterIcon size={20} weight="bold" /></span>
            <div><h2 id="tips-title">{text('قبل ما تطبع', 'Before you print')}</h2><p>{text('عشان الكود يتمسح من أول مرة.', 'So the code scans on the first try.')}</p></div>
          </header>
          <ul className="qr-tips">
            {tips.map(tip => <li key={tip}><span className="qr-tip-check" aria-hidden="true"><CheckIcon size={12} weight="bold" /></span>{tip}</li>)}
          </ul>
        </section>
      </div>
    </div>
  </div>;
}

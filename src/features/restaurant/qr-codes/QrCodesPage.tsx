import { useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { ArrowSquareOutIcon, DownloadSimpleIcon, FileSvgIcon, LightbulbIcon } from '@phosphor-icons/react';
import { CopyButton } from '../../../components/CopyButton';
import { PageHeader } from '../../../components/PageHeader';
import { useToast } from '../../../components/Toast';
import { useLanguage, usePageTitle } from '../../../lib/language';
import { useRestaurant } from '../queries';

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
  return <div className="page">
    <PageHeader title={text('كود QR', 'QR code')} description={text('الزبون يوجّه كاميرا موبايله على الكود ويفتح المنيو على طول، من غير ما ينزّل أي تطبيق.', 'Diners point their phone camera at the code and your menu opens instantly, no app needed.')} />
    <div className="qr-layout">
      <section className="card card-padded qr-card" aria-labelledby="qr-title">
        <h2 id="qr-title" className="visually-hidden">{text('الكود بتاعك', 'Your code')}</h2>
        <div className="table-card" style={{ ['--qr-accent' as string]: restaurant.brandColor ?? '#075e54' }}>
          <strong className="table-card-name">{restaurant.name}</strong>
          <span className="table-card-hint">{text('امسح الكود وشوف المنيو', 'Scan to see the menu')}</span>
          <div className="table-card-qr">
            <QRCodeSVG ref={svgRef} value={restaurant.publicUrl} size={220} level="M" marginSize={2} fgColor={fg} bgColor="#ffffff"
              title={text(`كود QR لمنيو ${restaurant.name}`, `QR code for the ${restaurant.name} menu`)} role="img" />
          </div>
          <span className="table-card-url ltr">{host}</span>
        </div>
        {/* Drawn off-screen at print size for the PNG download. */}
        <div hidden><QRCodeCanvas ref={canvasRef} value={restaurant.publicUrl} size={PNG_SIZE} level="M" marginSize={4} fgColor={fg} bgColor="#ffffff" /></div>
        <fieldset className="field qr-color">
          <legend className="field-label">{text('لون الكود', 'Code color')}</legend>
          <div className="segmented">
            {COLORS.map(entry => <label key={entry.id}>
              <input type="radio" name="qr-color" value={entry.id} checked={color === entry.id} onChange={() => setColor(entry.id)} />
              <span className="swatch" style={{ background: entry.value }} aria-hidden="true" />{text(entry.ar, entry.en)}
            </label>)}
          </div>
        </fieldset>
      </section>

      <div className="qr-side">
        <section className="card card-padded" aria-labelledby="download-title">
          <div className="card-header"><div>
            <h2 id="download-title">{text('نزّل الكود', 'Download')}</h2>
            <p>{text('PNG للطباعة السريعة والسوشيال، وSVG للمطابع عشان يفضل حاد في أي مقاس.', 'PNG for quick printing and social media; SVG for print shops, sharp at any size.')}</p>
          </div></div>
          <div className="download-buttons">
            <button type="button" className="button button-primary" onClick={downloadPng}><DownloadSimpleIcon size={18} aria-hidden="true" />{text('صورة PNG (١٠٢٤ بكسل)', 'PNG image (1024 px)')}</button>
            <button type="button" className="button button-secondary" onClick={downloadSvg}><FileSvgIcon size={18} aria-hidden="true" />{text('ملف SVG للطباعة', 'SVG for print')}</button>
          </div>
        </section>
        <section className="card card-padded" aria-labelledby="url-title">
          <div className="card-header"><div>
            <h2 id="url-title">{text('اللينك اللي في الكود', 'The link in the code')}</h2>
            <p>{text('نفس اللينك ده تقدر تحطه في البايو أو تبعته واتساب.', 'Use the same link in your bio or send it on WhatsApp.')}</p>
          </div></div>
          <p className="public-url ltr">{host}</p>
          <div className="form-actions">
            <CopyButton value={restaurant.publicUrl} label={text('انسخ اللينك', 'Copy link')} />
            <a className="button button-ghost button-small" href={restaurant.publicUrl} target="_blank" rel="noreferrer"><ArrowSquareOutIcon size={17} aria-hidden="true" />{text('افتح المنيو', 'Open menu')}</a>
          </div>
        </section>
        <section className="card card-padded tips-card" aria-labelledby="tips-title">
          <div className="card-header"><h2 id="tips-title"><LightbulbIcon size={20} aria-hidden="true" /> {text('نصايح للطباعة', 'Printing tips')}</h2></div>
          <ul className="tips">
            <li>{text('خلّي الكود ٣ سم على الأقل، و٥ سم أحسن على الترابيزة.', 'Print the code at least 3 cm wide; 5 cm is better on tables.')}</li>
            <li>{text('سيب مساحة بيضا حوالين الكود، ومتحطش عليه لوجو أو كلام.', 'Keep a white margin around the code and don’t print over it.')}</li>
            <li>{text('استخدم ورق مط (مش لامع) عشان الإضاءة متعكسش عليه.', 'Use matte paper so lights don’t reflect off it.')}</li>
            <li>{text('جرّب تمسح الكود بموبايلك قبل ما تطبع كمية كبيرة.', 'Scan a test print with your phone before printing many.')}</li>
            <li>{text('الكود مش بيتغير لما تعدّل المنيو، فمش محتاج تطبع تاني.', 'The code never changes when you edit the menu, so you won’t need to reprint.')}</li>
          </ul>
        </section>
      </div>
    </div>
  </div>;
}

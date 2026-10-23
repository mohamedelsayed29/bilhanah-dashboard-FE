import { GlobeHemisphereWestIcon } from '@phosphor-icons/react';
import { useLanguage } from '../lib/language';

export function LanguageToggle({ plain = false }: { plain?: boolean }) {
  const { text, toggleLanguage } = useLanguage();
  return <button type="button" className={`language-button ${plain ? 'language-button-plain' : ''}`} onClick={toggleLanguage}
    aria-label={text('Switch to English', 'عربي، التبديل للعربية')} lang={text('en', 'ar')}>
    <GlobeHemisphereWestIcon size={17} aria-hidden="true" /><span aria-hidden="true">{text('English', 'عربي')}</span>
  </button>;
}

import { Link } from 'react-router';
import { useLanguage } from '../lib/language';

export function Brand({ inverse = false, to = '/' }: { inverse?: boolean; to?: string }) {
  const { text } = useLanguage();
  return <Link to={to} className="brand" aria-label={text('بالهنا، الرئيسية', 'Bilhanah home')}>
    <img src={inverse ? '/brand/bilhanah-logo-light.svg' : '/brand/bilhanah-logo.svg'} alt="" width="1507" height="479" decoding="async" />
  </Link>;
}

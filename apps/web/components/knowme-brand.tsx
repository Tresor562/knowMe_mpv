import Image from 'next/image';
import Link from 'next/link';

type KnowMeBrandProps = {
  href?: string;
  compact?: boolean;
  className?: string;
};

export function KnowMeBrand({ href = '/', compact = false, className = '' }: KnowMeBrandProps) {
  return (
    <Link href={href} aria-label="KnowMe — accueil" className={`km-brand ${compact ? 'km-brand-compact' : ''} ${className}`}>
      <Image src="/brand/knowme-logo.svg" width={52} height={52} alt="" priority className="km-brand-logo" unoptimized />
      <span className="km-brand-wordmark">KnowMe</span>
    </Link>
  );
}

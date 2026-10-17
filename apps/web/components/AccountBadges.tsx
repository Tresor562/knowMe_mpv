'use client';

import { useId } from 'react';
import type { PremiumBadge, StaffBadge, VerificationBadge } from '../lib/use-session';

// Rounded, twelve-lobed KnowMe seal — deliberately original artwork.
const GOLD_SEAL_PATH = Array.from({ length: 145 }, (_, index) => {
  const theta = (Math.PI * 2 * index) / 144 - Math.PI / 2;
  const radius = 9.1 + 1.12 * Math.cos(12 * (theta + Math.PI / 2));
  const x = (12 + radius * Math.cos(theta)).toFixed(3);
  const y = (12 + radius * Math.sin(theta)).toFixed(3);
  return `${index === 0 ? 'M' : 'L'}${x},${y}`;
}).join(' ') + ' Z';

function StaffVerifiedSeal({ size, gold }: { size: number; gold: boolean }) {
  const gradientId = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={gold ? '#FFE9A0' : '#D9E1E9'} />
          <stop offset="39%" stopColor={gold ? '#F5C54C' : '#9CA9B8'} />
          <stop offset="100%" stopColor={gold ? '#C78A12' : '#657386'} />
        </linearGradient>
      </defs>
      <path d={GOLD_SEAL_PATH} fill={`url(#${gradientId})`}
        stroke={gold ? '#AE7612' : '#59677A'} strokeWidth=".36" strokeLinejoin="round" />
      <path d="M7.35 12.05 10.65 15.1 16.8 8.8" stroke="#fff"
        strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


export type AccountBadgeSet = {
  staff?: StaffBadge | null;
  verification?: VerificationBadge | null;
  premium?: PremiumBadge | null;
};

/** Compact, server-authoritative identity markers. Subscriptions are not profile status plaques. */
export function AccountBadges({ staff, verification, premium, compact = false }: AccountBadgeSet & { compact?: boolean }) {
  if (!staff && !verification && !premium) return null;
  const size = compact ? 18 : 20;
  return (
    <span className="km-account-badges" aria-label="Statuts vérifiés du compte">
      {verification && <span className="km-account-verification" title={verification.label}
        aria-label={verification.label}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={GOLD_SEAL_PATH} fill="#1877F2" strokeLinejoin="round" />
          <path d="M7.2 12.2 10.45 15.25 16.8 8.8" stroke="#fff" strokeWidth="2.55" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>}
      {premium && <span className="km-account-premium" title={premium.label} aria-label={premium.label}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m12 2.5 8.5 9.5-8.5 9.5L3.5 12 12 2.5Z" fill="var(--orange)" stroke="var(--text)" strokeOpacity=".22" strokeWidth=".8"/>
          <path d="m8 12 4 5 4-5-4-5-4 5Z" fill="var(--on-accent)" fillOpacity=".75"/>
        </svg>
      </span>}
      {!verification?.isVerified && staff && <span className="km-account-staff" title={staff.label + ' · ' + staff.role}
        aria-label={staff.label + ', ' + staff.role}>
<StaffVerifiedSeal size={size} gold={staff.shield === 'GOLD'} />
      </span>}
    </span>
  );
}

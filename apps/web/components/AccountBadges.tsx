'use client';

import { useId } from 'react';
import type { PremiumBadge, StaffBadge, VerificationBadge } from '../lib/use-session';

// Rounded, twelve-lobed KnowMe seal — deliberately original artwork.
const GOLD_SEAL_PATH = Array.from({ length: 145 }, (_, index) => {
  const theta = (Math.PI * 2 * index) / 144 - Math.PI / 2;
  const radius = 9.45 + 0.58 * Math.cos(12 * (theta + Math.PI / 2));
  const x = (12 + radius * Math.cos(theta)).toFixed(3);
  const y = (12 + radius * Math.sin(theta)).toFixed(3);
  return `${index === 0 ? 'M' : 'L'}${x},${y}`;
}).join(' ') + ' Z';

function GoldVerifiedSeal({ size }: { size: number }) {
  const gradientId = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE9A0" />
          <stop offset="39%" stopColor="#F5C54C" />
          <stop offset="100%" stopColor="#C78A12" />
        </linearGradient>
      </defs>
      <path d={GOLD_SEAL_PATH} fill={`url(#${gradientId})`}
        stroke="#AE7612" strokeWidth=".36" strokeLinejoin="round" />
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
          <circle cx="12" cy="12" r="10" fill="#4a9fea"/>
          <path d="m7.4 12 3.2 3.2 6-6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>}
      {premium && <span className="km-account-premium" title={premium.label} aria-label={premium.label}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m12 2.5 8.5 9.5-8.5 9.5L3.5 12 12 2.5Z" fill="var(--orange)" stroke="var(--text)" strokeOpacity=".22" strokeWidth=".8"/>
          <path d="m8 12 4 5 4-5-4-5-4 5Z" fill="var(--on-accent)" fillOpacity=".75"/>
        </svg>
      </span>}
      {staff && <span className="km-account-staff" title={staff.label + ' · ' + staff.role}
        aria-label={staff.label + ', ' + staff.role}>
<GoldVerifiedSeal size={size} />
      </span>}
    </span>
  );
}

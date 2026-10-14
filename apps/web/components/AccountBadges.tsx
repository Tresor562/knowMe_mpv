'use client';

import type { PremiumBadge, StaffBadge, VerificationBadge } from '../lib/use-session';

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
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m12 1.8 3.4 1.6 3.7.4 1.1 3.5 2.2 2.9-1.5 3.3-.2 3.8-3.5 1.2L14.5 21 12 22.2 9.5 21l-2.7-2.5-3.5-1.2-.2-3.8-1.5-3.3 2.2-2.9 1.1-3.5 3.7-.4z"
            fill="#e5b84f" stroke="#a87619" strokeWidth=".7"/>
          <path d="m7.8 11.8 2.7 2.7 5.8-6" stroke="#482f08" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>}
    </span>
  );
}

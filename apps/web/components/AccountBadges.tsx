'use client';

import type {
  PremiumBadge,
  StaffBadge,
  VerificationBadge
} from '../lib/use-session';

export type AccountBadgeSet = {
  staff?: StaffBadge | null;
  verification?: VerificationBadge | null;
  premium?: PremiumBadge | null;
};

export function AccountBadges({
  staff,
  verification,
  premium,
  compact = false
}: AccountBadgeSet & { compact?: boolean }) {
  if (!staff && !verification && !premium) return null;

  const padding = compact ? '4px 8px' : '7px 12px';
  const fontSize = compact ? 11 : 13;

  return (
    <div
      aria-label="Badges autoritaires du compte"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}
    >
      {verification && (
        <span
          title={`Vérifiée jusqu’au ${new Date(verification.expiresAt).toLocaleDateString('fr-FR')}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #65b7ff',
            color: '#65b7ff',
            background: 'rgba(101,183,255,.08)',
            borderRadius: 999,
            padding,
            fontWeight: 900,
            fontSize
          }}
        >
          <span aria-hidden="true">✓</span>
          {verification.label}
        </span>
      )}
      {premium && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #d8a7ff',
            color: '#d8a7ff',
            background: 'rgba(216,167,255,.08)',
            borderRadius: 999,
            padding,
            fontWeight: 900,
            fontSize
          }}
        >
          <span aria-hidden="true">◆</span>
          {premium.label}
        </span>
      )}
      {staff && (
        <span
          aria-label={`${staff.label}, ${staff.role}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #f4c95d',
            color: '#f4c95d',
            background: 'rgba(244,201,93,.08)',
            borderRadius: 999,
            padding,
            fontWeight: 900,
            fontSize
          }}
        >
          <span aria-hidden="true">🛡️</span>
          {staff.label} · {staff.role}
        </span>
      )}
    </div>
  );
}

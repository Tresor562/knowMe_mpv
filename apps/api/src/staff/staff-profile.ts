import { createHash } from 'crypto';

export const staffAccountSelect = {
  status: true,
  staffRole: true,
  badgeLabel: true,
  shieldStyle: true
} as const;

export type StaffProfileRecord = {
  status: string;
  staffRole: string;
  badgeLabel: string;
  shieldStyle: string;
} | null;

// Explicitly approved owner accounts. Keep raw e-mail addresses out of the code,
// API responses and logs. Gmail alone never entitles a new account to a badge.
const APPROVED_OWNER_GMAIL_DIGESTS = new Set([
  '1f9fc26673a75a83e1346c1f66576230534353546fbe3c7940da204bfc9a5d1d',
  'b209fcb81b184da7d76d5fd8e864052cbf22d73ad5a4b6199c792bfe1fbce076',
  'b14e9515ced5acedf338d4e0b21353c2db44448ff26ee3f27f63cbb2eb17d4c6',
  '3109cc2f1ac2ea5096303fc2969e52fbeeeb24af7d208ade31441d286c8fb364'
]);

export function isApprovedOwnerGmail(accountEmail?: string | null): boolean {
  const email = (accountEmail ?? '').trim().toLowerCase();
  return email.endsWith('@gmail.com') &&
    APPROVED_OWNER_GMAIL_DIGESTS.has(createHash('sha256').update(email, 'utf8').digest('hex'));
}

export function toStaffBadge(staffAccount: StaffProfileRecord, accountEmail?: string | null) {
  const approvedOwner = isApprovedOwnerGmail(accountEmail);

  // Explicit suspension/revocation takes precedence over the owner allowlist.
  if (staffAccount && staffAccount.status !== 'ACTIVE') return null;

  if (!staffAccount) {
    // This is a display-only certification, NOT a StaffAccount registration.
    // The JWT's actual role and all RBAC permissions still come from the DB.
    // It works even before a one-off VPS/SSH migration has been executed.
    return approvedOwner ? {
      isTeamMember: true as const,
      label: 'Compte certifié KnowMe',
      shield: 'GOLD',
      role: 'CERTIFIED'
    } : null;
  }

  // Only the explicitly approved Gmail accounts can render gold. Other active
  // staff members retain a neutral badge with no change to their privileges.
  return {
    isTeamMember: true as const,
    label: staffAccount.badgeLabel,
    shield: approvedOwner ? 'GOLD' : staffAccount.shieldStyle === 'GOLD'
      ? 'STANDARD'
      : staffAccount.shieldStyle,
    role: staffAccount.staffRole
  };
}

export function withStaffBadge<T extends { staffAccount: StaffProfileRecord; email?: string | null }>(
  user: T
) {
  const { staffAccount, ...profile } = user;
  return {
    ...profile,
    staff: toStaffBadge(staffAccount, user.email)
  };
}

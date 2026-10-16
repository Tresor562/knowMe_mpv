export const staffAccountSelect = {
  status: true,
  staffRole: true,
  badgeLabel: true,
  shieldStyle: true,
  user: { select: { email: true } }
} as const;

export type StaffProfileRecord = {
  status: string;
  staffRole: string;
  badgeLabel: string;
  shieldStyle: string;
  user?: { email: string } | null;
} | null;

export function toStaffBadge(staffAccount: StaffProfileRecord) {
  if (!staffAccount || staffAccount.status !== 'ACTIVE') return null;

  // A public gold seal is restricted to explicitly approved Gmail accounts.
  // Staff membership and access rights remain independent from badge color.
  // The account email comes from the related DB user, never from client input.
  const gmailAccount = (staffAccount.user?.email ?? '').trim().toLowerCase().endsWith('@gmail.com');
  const shield = staffAccount.shieldStyle === 'GOLD' && !gmailAccount
    ? 'STANDARD'
    : staffAccount.shieldStyle;

  return {
    isTeamMember: true as const,
    label: staffAccount.badgeLabel,
    shield,
    role: staffAccount.staffRole
  };
}

export function withStaffBadge<T extends { staffAccount: StaffProfileRecord }>(
  user: T
) {
  const { staffAccount, ...profile } = user;
  return {
    ...profile,
    staff: toStaffBadge(staffAccount)
  };
}

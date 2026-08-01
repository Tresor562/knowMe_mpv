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

export function toStaffBadge(staffAccount: StaffProfileRecord) {
  if (!staffAccount || staffAccount.status !== 'ACTIVE') return null;

  return {
    isTeamMember: true,
    label: staffAccount.badgeLabel,
    shield: staffAccount.shieldStyle,
    role: staffAccount.staffRole
  };
}

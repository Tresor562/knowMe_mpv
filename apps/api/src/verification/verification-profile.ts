import {
  StaffProfileRecord,
  toStaffBadge
} from '../staff/staff-profile';

export const verificationRequestSelect = {
  where: { status: 'APPROVED' },
  orderBy: { decidedAt: 'desc' as const },
  take: 1,
  select: {
    id: true,
    status: true,
    level: true,
    decidedAt: true,
    expiresAt: true
  }
} as const;

export const premiumEntitlementSelect = (now: Date) => ({
  where: {
    key: 'premium.core',
    startsAt: { lte: now },
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
  },
  select: {
    id: true,
    key: true,
    expiresAt: true
  },
  take: 1
});

export type VerificationProfileRecord = Array<{
  id: string;
  status: string;
  level: string;
  decidedAt: Date | null;
  expiresAt: Date | null;
}>;

export type PremiumProfileRecord = Array<{
  id: string;
  key: string;
  expiresAt: Date | null;
}>;

export function toVerificationBadge(
  requests: VerificationProfileRecord,
  now = new Date()
) {
  const approved = requests.find(
    (request) =>
      request.status === 'APPROVED' &&
      Boolean(request.decidedAt) &&
      Boolean(request.expiresAt) &&
      request.expiresAt! > now
  );
  if (!approved) return null;

  return {
    isVerified: true as const,
    label: 'Identité vérifiée',
    level: approved.level,
    verifiedAt: approved.decidedAt,
    expiresAt: approved.expiresAt,
    verificationId: approved.id
  };
}

export function toPremiumBadge(grants: PremiumProfileRecord) {
  const grant = grants[0];
  if (!grant) return null;

  return {
    isPremium: true as const,
    label: 'Premium',
    expiresAt: grant.expiresAt
  };
}

export function withAccountBadges<
  T extends {
    staffAccount: StaffProfileRecord;
    verificationRequests: VerificationProfileRecord;
    entitlementGrants: PremiumProfileRecord;
  }
>(user: T, now = new Date()) {
  const {
    staffAccount,
    verificationRequests,
    entitlementGrants,
    ...profile
  } = user;

  return {
    ...profile,
    staff: toStaffBadge(staffAccount),
    verification: toVerificationBadge(verificationRequests, now),
    premium: toPremiumBadge(entitlementGrants)
  };
}

import { PrismaService } from '../prisma/prisma.service';

export type VerifiedIdentityRecord = {
  status: string;
  badgeLabel: string;
  category: string;
  verifiedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

export const verifiedIdentitySelect = {
  status: true,
  badgeLabel: true,
  category: true,
  verifiedAt: true,
  expiresAt: true,
  revokedAt: true
} as const;

export function toVerifiedBadge(identity: VerifiedIdentityRecord | null | undefined) {
  const now = new Date();
  if (
    !identity ||
    identity.status !== 'ACTIVE' ||
    identity.revokedAt ||
    (identity.expiresAt && identity.expiresAt <= now)
  ) {
    return null;
  }

  return {
    verified: true as const,
    label: identity.badgeLabel,
    category: identity.category,
    verifiedAt: identity.verifiedAt,
    expiresAt: identity.expiresAt
  };
}

export async function loadVerifiedBadges(
  prisma: PrismaService,
  userIds: string[]
) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return new Map<string, ReturnType<typeof toVerifiedBadge>>();

  const identities = await prisma.verifiedIdentity.findMany({
    where: {
      userId: { in: uniqueIds },
      status: 'ACTIVE',
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    select: {
      userId: true,
      ...verifiedIdentitySelect
    }
  });

  return new Map(
    identities.map((identity) => [identity.userId, toVerifiedBadge(identity)])
  );
}

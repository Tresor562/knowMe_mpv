export function normalizeMemberSearchQuery(value: string) {
  return value
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40);
}

export function validateMemberSearch(input: {
  query: string;
  requestedLimit?: number;
}) {
  const query = normalizeMemberSearchQuery(input.query);
  if (query.length < 2) {
    throw new Error('La recherche doit contenir au moins deux caractères.');
  }
  const limit = Math.min(20, Math.max(1, input.requestedLimit ?? 12));
  return { query, limit } as const;
}

export function toPublicMemberDirectoryEntry(input: {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  friendshipStatus?: string | null;
  membershipStatus?: string | null;
  membershipRole?: string | null;
}) {
  return {
    id: input.id,
    username: input.username,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl,
    relationship: {
      friendshipStatus: input.friendshipStatus ?? null,
      membershipStatus: input.membershipStatus ?? null,
      membershipRole: input.membershipRole ?? null
    },
    privacy: {
      emailExposed: false,
      knowCoinsExposed: false,
      walletExposed: false,
      lastActivityExposed: false,
      privateInterestsExposed: false
    }
  } as const;
}

import {
  normalizeMemberSearchQuery,
  toPublicMemberDirectoryEntry,
  validateMemberSearch
} from './profile-member-directory.domain';

describe('profile member directory', () => {
  it('normalizes usernames and limits query length', () => {
    expect(normalizeMemberSearchQuery('  @@Trésor   Nexus  ')).toBe('Trésor Nexus');
    expect(normalizeMemberSearchQuery(`@${'a'.repeat(80)}`)).toHaveLength(40);
  });

  it('requires a meaningful query and caps result size', () => {
    expect(() => validateMemberSearch({ query: '@a' })).toThrow('deux caractères');
    expect(validateMemberSearch({ query: '@nexus', requestedLimit: 100 })).toEqual({
      query: 'nexus',
      limit: 20
    });
  });

  it('returns only invitation-safe public fields', () => {
    const entry = toPublicMemberDirectoryEntry({
      id: 'user-1',
      username: 'tresor',
      displayName: 'Trésor',
      avatarUrl: null,
      friendshipStatus: 'ACCEPTED',
      membershipStatus: 'ACTIVE',
      membershipRole: 'MEMBER'
    });
    expect(entry).toEqual({
      id: 'user-1',
      username: 'tresor',
      displayName: 'Trésor',
      avatarUrl: null,
      relationship: {
        friendshipStatus: 'ACCEPTED',
        membershipStatus: 'ACTIVE',
        membershipRole: 'MEMBER'
      },
      privacy: {
        emailExposed: false,
        knowCoinsExposed: false,
        walletExposed: false,
        lastActivityExposed: false,
        privateInterestsExposed: false
      }
    });
    expect(entry).not.toHaveProperty('email');
    expect(entry).not.toHaveProperty('knowCoins');
  });
});

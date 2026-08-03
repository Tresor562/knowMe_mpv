import {
  circleStoryDurationPolicy,
  familyRelationPairKey,
  inverseFamilyRelationType,
  resolveCircleContentInitialStatus,
  roleHasCirclePermission,
  validateCircleRoleChange,
  validateFamilyRelationProposal,
  validateOwnershipTransfer
} from './profile-circle-governance.domain';

describe('collective profile governance', () => {
  it('keeps ownership transfer explicit, limited and expiring', () => {
    const now = new Date('2026-08-03T12:00:00Z');
    expect(
      validateOwnershipTransfer({
        actorIsCurrentOwner: true,
        targetIsActiveMember: true,
        targetIsCurrentOwner: false,
        pendingTransferExists: false,
        expiresAt: new Date('2026-08-06T12:00:00Z'),
        now
      })
    ).toBe(true);
    expect(() =>
      validateOwnershipTransfer({
        actorIsCurrentOwner: true,
        targetIsActiveMember: true,
        targetIsCurrentOwner: false,
        pendingTransferExists: false,
        expiresAt: new Date('2026-08-20T12:00:00Z'),
        now
      })
    ).toThrow('sept jours');
  });

  it('reserves role management and ownership to the owner', () => {
    expect(roleHasCirclePermission('OWNER', 'MANAGE_ROLES')).toBe(true);
    expect(roleHasCirclePermission('ADMIN', 'MANAGE_ROLES')).toBe(false);
    expect(() =>
      validateCircleRoleChange({
        actorRole: 'OWNER',
        targetIsOwner: false,
        nextRole: 'OWNER',
        circleType: 'TEAM'
      })
    ).toThrow('transfert');
    expect(() =>
      validateCircleRoleChange({
        actorRole: 'OWNER',
        targetIsOwner: false,
        nextRole: 'ADMIN',
        circleType: 'DUO_GAMING'
      })
    ).toThrow('Duo');
  });

  it('moderates public member content while allowing member-only content', () => {
    expect(
      resolveCircleContentInitialStatus({ role: 'MEMBER', audience: 'PUBLIC' })
    ).toBe('PENDING');
    expect(
      resolveCircleContentInitialStatus({ role: 'MEMBER', audience: 'MEMBERS' })
    ).toBe('APPROVED');
    expect(
      resolveCircleContentInitialStatus({ role: 'OFFICER', audience: 'PUBLIC' })
    ).toBe('APPROVED');
  });

  it('caps collective stories by earned level', () => {
    expect(circleStoryDurationPolicy(1).maximumHours).toBe(24);
    expect(circleStoryDurationPolicy(2).maximumHours).toBe(48);
    expect(circleStoryDurationPolicy(5)).toMatchObject({
      maximumHours: 72,
      permanentAllowed: false,
      purchasableLevelBoost: false
    });
  });

  it('requires family links to involve the proposer and two active members', () => {
    expect(
      validateFamilyRelationProposal({
        circleId: 'family-1',
        circleType: 'FAMILY',
        proposerUserId: 'alice',
        firstUserId: 'alice',
        secondUserId: 'bob',
        firstIsActiveMember: true,
        secondIsActiveMember: true,
        type: 'PARENT'
      })
    ).toEqual({
      pairKey: familyRelationPairKey('family-1', 'alice', 'bob'),
      inverseType: 'CHILD'
    });
    expect(inverseFamilyRelationType('SIBLING')).toBe('SIBLING');
    expect(() =>
      validateFamilyRelationProposal({
        circleId: 'family-1',
        circleType: 'FAMILY',
        proposerUserId: 'charlie',
        firstUserId: 'alice',
        secondUserId: 'bob',
        firstIsActiveMember: true,
        secondIsActiveMember: true,
        type: 'SIBLING'
      })
    ).toThrow('concerne');
  });
});

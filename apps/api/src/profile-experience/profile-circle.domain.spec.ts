import {
  canViewProfileCircle,
  circleLevelFromXp,
  transitionCircleStatus,
  validateCircleActivity,
  validateCircleJoinRequest
} from './profile-circle.domain';

describe('collective profile domain', () => {
  it('keeps collective levels earned and capped at five', () => {
    expect(circleLevelFromXp(0)).toMatchObject({ level: 1, purchasable: false });
    expect(circleLevelFromXp(5_000)).toMatchObject({ level: 2, remainingXp: 15_000 });
    expect(circleLevelFromXp(250_000)).toMatchObject({
      level: 5,
      nextLevelXp: null,
      premiumCanIncreaseLevel: false
    });
  });

  it('only lets the owner pause, resume or end a collective profile', () => {
    expect(
      transitionCircleStatus({
        currentStatus: 'ACTIVE',
        action: 'PAUSE',
        actorIsOwner: true
      })
    ).toBe('PAUSED');
    expect(() =>
      transitionCircleStatus({
        currentStatus: 'ACTIVE',
        action: 'END',
        actorIsOwner: false
      })
    ).toThrow('propriétaire');
    expect(() =>
      transitionCircleStatus({
        currentStatus: 'ENDED',
        action: 'RESUME',
        actorIsOwner: true
      })
    ).toThrow('terminée');
  });

  it('never exposes private circles to unrelated visitors', () => {
    expect(
      canViewProfileCircle({
        visibility: 'PRIVATE',
        viewerIsMember: false,
        viewerIsFriendOfOwner: true,
        viewerIsFollowerOfOwner: true
      }).visible
    ).toBe(false);
    expect(
      canViewProfileCircle({
        visibility: 'PRIVATE',
        viewerIsMember: true,
        viewerIsFriendOfOwner: false,
        viewerIsFollowerOfOwner: false
      }).visible
    ).toBe(true);
  });

  it('accepts join requests only for active, open guilds with capacity', () => {
    expect(
      validateCircleJoinRequest({
        type: 'GUILD',
        status: 'ACTIVE',
        joinable: true,
        memberCount: 12,
        maximumMembers: 500,
        alreadyMember: false
      })
    ).toBe(true);
    expect(() =>
      validateCircleJoinRequest({
        type: 'TEAM',
        status: 'ACTIVE',
        joinable: true,
        memberCount: 3,
        maximumMembers: 7,
        alreadyMember: false
      })
    ).toThrow('guildes');
  });

  it('validates idempotent collective XP activity', () => {
    expect(
      validateCircleActivity({
        type: 'CHALLENGE_WON',
        xpAwarded: 500,
        idempotencyKey: 'challenge:abc:circle:xyz'
      })
    ).toBe(true);
    expect(() =>
      validateCircleActivity({
        type: 'GAME_WON',
        xpAwarded: 50_000,
        idempotencyKey: 'game:1'
      })
    ).toThrow('XP');
  });
});

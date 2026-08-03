import {
  CommunityProgressionMetrics,
  assertCommunityStoryDurationAllowed,
  calculateCommunityProgression,
  communitiesPolicy,
  communityUnlocks,
  participantCap,
  permissionsForRole,
  validateInvitePolicy
} from './communities.domain';

function metrics(
  overrides: Partial<CommunityProgressionMetrics> = {}
): CommunityProgressionMetrics {
  return {
    entityType: 'GROUP',
    ageDays: 400,
    totalParticipants: 20_000,
    activeParticipants30d: 6_000,
    uniqueActiveDays30d: 30,
    messages30d: 50_000,
    publications30d: 2_000,
    reactions30d: 60_000,
    stories30d: 500,
    completedChallenges30d: 300,
    gifts30d: 250,
    events90d: 40,
    retentionBps: 9_400,
    contentQualityScore: 96,
    unresolvedReports90d: 2,
    confirmedViolations90d: 0,
    repeatedContentRatioBps: 500,
    historicalXp: 220_000,
    ...overrides
  };
}

describe('communities domain', () => {
  it('makes level 5 prestigious and independent from Premium', () => {
    const result = calculateCommunityProgression(metrics());
    expect(result.level).toBe(5);
    expect(result.reputationScore).toBeGreaterThanOrEqual(92);
    expect(communitiesPolicy()).toMatchObject({
      maximumLevel: 5,
      levelPurchasable: false,
      premiumChangesLevel: false
    });
  });

  it('penalizes repeated spam and confirmed violations', () => {
    const clean = calculateCommunityProgression(metrics());
    const abusive = calculateCommunityProgression(
      metrics({
        repeatedContentRatioBps: 9_000,
        confirmedViolations90d: 5,
        unresolvedReports90d: 100
      })
    );
    expect(abusive.xpEarnedFromWindow).toBeLessThan(clean.xpEarnedFromWindow);
    expect(abusive.level).toBeLessThan(5);
    expect(abusive.spamPenaltyXp).toBeGreaterThan(0);
    expect(abusive.moderationPenaltyXp).toBeGreaterThan(0);
    expect(abusive.missingRequirements).toContain('REPUTATION_55');
  });

  it('does not let inactive purchased members produce prestige', () => {
    const result = calculateCommunityProgression(
      metrics({
        totalParticipants: 500_000,
        activeParticipants30d: 20,
        ageDays: 500,
        historicalXp: 500_000
      })
    );
    expect(result.level).toBe(1);
    expect(result.missingRequirements).toContain('ACTIVE_PARTICIPANTS_50');
  });

  it('unlocks group and channel abilities progressively', () => {
    expect(communityUnlocks('GROUP', 3)).toEqual(
      expect.arrayContaining(['GROUP_CHAT', 'POLLS', 'EVENTS', 'MEMBER_BADGES'])
    );
    expect(communityUnlocks('CHANNEL', 3)).toEqual(
      expect.arrayContaining(['PUBLICATIONS', 'SIMPLE_ANALYTICS', 'COMMENTS'])
    );
    expect(participantCap('GROUP', 1)).toBe(100);
    expect(participantCap('CHANNEL', 5)).toBeNull();
  });

  it('enforces free, premium and permanent Story durations by level', () => {
    expect(() =>
      assertCommunityStoryDurationAllowed(24, {
        level: 1,
        hasPremiumEntitlement: false,
        canPublishStories: true,
        scheduled: false,
        restrictedAudience: false
      })
    ).not.toThrow();

    expect(() =>
      assertCommunityStoryDurationAllowed(72, {
        level: 1,
        hasPremiumEntitlement: false,
        canPublishStories: true,
        scheduled: false,
        restrictedAudience: false
      })
    ).toThrow('niveau supérieur');

    expect(() =>
      assertCommunityStoryDurationAllowed('PERMANENT', {
        level: 4,
        hasPremiumEntitlement: true,
        canPublishStories: true,
        scheduled: true,
        restrictedAudience: true
      })
    ).not.toThrow();
  });

  it('validates permanent, temporary and approval links', () => {
    expect(() =>
      validateInvitePolicy({
        mode: 'PERMANENT',
        expiresAt: null,
        maximumUses: null,
        requiresApproval: false
      })
    ).not.toThrow();

    expect(() =>
      validateInvitePolicy(
        {
          mode: 'TEMPORARY',
          expiresAt: new Date('2026-08-04T10:00:00.000Z'),
          maximumUses: 100,
          requiresApproval: false
        },
        new Date('2026-08-03T10:00:00.000Z')
      )
    ).not.toThrow();
  });

  it('keeps channel subscribers read-oriented and groups participative', () => {
    expect(permissionsForRole('CHANNEL', 'SUBSCRIBER')).not.toContain(
      'PUBLISH_POSTS'
    );
    expect(permissionsForRole('GROUP', 'MEMBER')).toContain('SEND_MESSAGES');
    expect(permissionsForRole('GROUP', 'OWNER')).toContain('TRANSFER_OWNERSHIP');
  });
});

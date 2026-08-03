import {
  PRIVATE_PROFILE_FIELD_KEYS,
  PUBLIC_PROFILE_STAT_KEYS,
  sanitizePublicProfileSnapshot,
  sanitizePublicProfileStatistics
} from './profile-public-privacy';

describe('public profile financial privacy', () => {
  it('never exposes KnowCoins or wallet values to another viewer', () => {
    const sanitized = sanitizePublicProfileSnapshot({
      viewer: { owner: false },
      privacy: { serverResolved: true },
      header: {
        username: 'tresor',
        knowCoins: 9_999,
        nested: { walletBalance: 500 }
      },
      statistics: {
        level: 52,
        xp: 120_000,
        knowCoinsEarned: 25_000,
        knowCoinsSpent: 12_000,
        messagesSent: 8_000,
        activeMinutes: 50_000,
        futureFinancialMetric: 777
      }
    });

    expect(sanitized.header).toEqual({
      username: 'tresor',
      nested: {}
    });
    expect(sanitized.statistics).toEqual({ level: 52, xp: 120_000 });
    expect(sanitized.privacy).toMatchObject({
      financialDataOmitted: true,
      unknownStatisticsPrivateByDefault: true,
      publicStatisticsAllowlisted: true
    });
  });

  it('keeps unknown statistics private by default', () => {
    expect(
      sanitizePublicProfileStatistics(
        {
          level: 3,
          experimentalMetric: 10,
          creatorRevenue: 500,
          giftsReceived: 4
        },
        false
      )
    ).toEqual({ level: 3, giftsReceived: 4 });
  });

  it('allows the owner to receive the complete private dashboard statistics', () => {
    const metrics = {
      level: 3,
      knowCoinsEarned: 900,
      knowCoinsSpent: 300,
      messagesSent: 80,
      activeMinutes: 120
    };
    expect(sanitizePublicProfileStatistics(metrics, true)).toEqual(metrics);
    expect(
      sanitizePublicProfileSnapshot({
        viewer: { owner: true },
        statistics: metrics
      }).statistics
    ).toEqual(metrics);
  });

  it('contains no financial field in the public allowlist', () => {
    expect(PUBLIC_PROFILE_STAT_KEYS).not.toContain('knowCoinsEarned');
    expect(PUBLIC_PROFILE_STAT_KEYS).not.toContain('knowCoinsSpent');
    expect(PRIVATE_PROFILE_FIELD_KEYS.has('knowCoins')).toBe(true);
    expect(PRIVATE_PROFILE_FIELD_KEYS.has('walletBalance')).toBe(true);
  });
});

import {
  applyProfileStatEvent,
  profileStatPrivacyPolicy,
  validateProfileStatEvent
} from './profile-stats.domain';

describe('profile statistic aggregation', () => {
  it('increments trusted counters and preserves idempotent inputs', () => {
    expect(
      applyProfileStatEvent(
        { challengesWon: 4 },
        {
          key: 'challengesWon',
          operation: 'INCREMENT',
          numericValue: 1
        }
      )
    ).toEqual({ challengesWon: 5 });
  });

  it('prevents level and streak regressions with SET_MAX', () => {
    expect(
      applyProfileStatEvent(
        { level: 52 },
        { key: 'level', operation: 'SET_MAX', numericValue: 40 }
      )
    ).toEqual({ level: 52 });
  });

  it('rejects unknown keys and invalid operations', () => {
    expect(() =>
      validateProfileStatEvent({
        key: 'futureRevenue',
        operation: 'INCREMENT',
        numericValue: 1,
        idempotencyKey: 'future:1'
      })
    ).toThrow('inconnue');
    expect(() =>
      validateProfileStatEvent({
        key: 'followers',
        operation: 'INCREMENT',
        numericValue: 1,
        idempotencyKey: 'followers:1'
      })
    ).toThrow('interdite');
  });

  it('keeps financial and usage metrics private', () => {
    const policy = profileStatPrivacyPolicy();
    expect(policy.privateKeys).toEqual(
      expect.arrayContaining([
        'knowCoinsEarned',
        'knowCoinsSpent',
        'messagesSent',
        'activeMinutes'
      ])
    );
    expect(policy.publicKeys).not.toContain('knowCoinsEarned');
    expect(policy.walletBalancePubliclyExposed).toBe(false);
    expect(policy.unknownKeysPrivateByDefault).toBe(true);
  });
});

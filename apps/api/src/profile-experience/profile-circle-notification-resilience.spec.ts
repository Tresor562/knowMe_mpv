import {
  isMandatoryPriority,
  nextRetryAt,
  priorityAtLeast,
  retryDelayMs,
  selectFirstAvailableRoute
} from './profile-circle-notification-resilience.domain';

describe('profile circle notification resilience', () => {
  it('orders priorities without trusting lexical order', () => {
    expect(priorityAtLeast('CRITICAL', 'LOW')).toBe(true);
    expect(priorityAtLeast('HIGH', 'NORMAL')).toBe(true);
    expect(priorityAtLeast('LOW', 'NORMAL')).toBe(false);
    expect(isMandatoryPriority('CRITICAL')).toBe(true);
    expect(isMandatoryPriority('HIGH')).toBe(false);
  });

  it('selects the first usable route', () => {
    const route = selectFirstAvailableRoute({
      candidates: [
        { channel: 'PUSH', provider: 'PUSH_A', priority: 'NORMAL' },
        { channel: 'EMAIL', provider: 'EMAIL_A', priority: 'NORMAL' }
      ],
      unavailableProviders: new Set(['PUSH_A']),
      disabledChannels: new Set()
    });
    expect(route).toEqual({
      channel: 'EMAIL',
      provider: 'EMAIL_A',
      priority: 'NORMAL'
    });
  });

  it('returns null when every route is unavailable', () => {
    const route = selectFirstAvailableRoute({
      candidates: [
        { channel: 'PUSH', provider: 'PUSH_A', priority: 'HIGH' }
      ],
      unavailableProviders: new Set(['PUSH_A']),
      disabledChannels: new Set(['EMAIL'])
    });
    expect(route).toBeNull();
  });

  it('produces deterministic bounded exponential retry delays', () => {
    const first = retryDelayMs({
      attempt: 1,
      idempotencyKey: 'notification-1',
      baseMs: 5_000,
      maximumMs: 60_000
    });
    const same = retryDelayMs({
      attempt: 1,
      idempotencyKey: 'notification-1',
      baseMs: 5_000,
      maximumMs: 60_000
    });
    const later = retryDelayMs({
      attempt: 8,
      idempotencyKey: 'notification-1',
      baseMs: 5_000,
      maximumMs: 60_000
    });
    expect(first).toBe(same);
    expect(first).toBeGreaterThanOrEqual(5_000);
    expect(first).toBeLessThanOrEqual(6_250);
    expect(later).toBeLessThanOrEqual(60_000);
  });

  it('returns an absolute retry timestamp', () => {
    const now = new Date('2026-08-03T21:00:00.000Z');
    const result = nextRetryAt({
      now,
      attempt: 2,
      idempotencyKey: 'notification-2',
      baseMs: 10_000,
      maximumMs: 60_000
    });
    expect(result.getTime()).toBeGreaterThan(now.getTime());
    expect(result.getTime() - now.getTime()).toBeLessThanOrEqual(25_000);
  });
});

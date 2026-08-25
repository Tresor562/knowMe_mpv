import {
  MEDIA_QUARANTINE_RETRY_BASE_DELAY_MS,
  MEDIA_QUARANTINE_RETRY_MAX_ATTEMPTS,
  getMediaQuarantineRetryDelayMs,
  isMediaQuarantineRetryEligible
} from './media-quarantine-retry-policy';

const NOW = new Date('2026-08-25T12:00:00.000Z');

function state(overrides: Partial<Parameters<typeof isMediaQuarantineRetryEligible>[0]> = {}) {
  return {
    status: 'QUARANTINED',
    scannerVerdict: 'UNAVAILABLE',
    deletedAt: null,
    scannerAttemptCount: 1,
    scannerLastAttemptAt: new Date(NOW.getTime() - MEDIA_QUARANTINE_RETRY_BASE_DELAY_MS),
    ...overrides
  };
}

describe('media quarantine retry policy', () => {
  it('uses bounded exponential backoff', () => {
    expect(getMediaQuarantineRetryDelayMs(1)).toBe(5 * 60 * 1000);
    expect(getMediaQuarantineRetryDelayMs(2)).toBe(10 * 60 * 1000);
    expect(getMediaQuarantineRetryDelayMs(3)).toBe(20 * 60 * 1000);
    expect(getMediaQuarantineRetryDelayMs(99)).toBe(6 * 60 * 60 * 1000);
  });

  it('allows an unavailable quarantined asset exactly at its retry boundary', () => {
    expect(isMediaQuarantineRetryEligible(state(), NOW)).toBe(true);
  });

  it('rejects retries before the required backoff elapsed', () => {
    expect(
      isMediaQuarantineRetryEligible(
        state({ scannerLastAttemptAt: new Date(NOW.getTime() - MEDIA_QUARANTINE_RETRY_BASE_DELAY_MS + 1) }),
        NOW
      )
    ).toBe(false);
  });

  it('fails closed for legacy rows without a known last-attempt timestamp', () => {
    expect(isMediaQuarantineRetryEligible(state({ scannerLastAttemptAt: null }), NOW)).toBe(false);
  });

  it('rejects deleted, available, infected and non-quarantined media', () => {
    expect(isMediaQuarantineRetryEligible(state({ deletedAt: new Date() }), NOW)).toBe(false);
    expect(isMediaQuarantineRetryEligible(state({ status: 'AVAILABLE' }), NOW)).toBe(false);
    expect(isMediaQuarantineRetryEligible(state({ scannerVerdict: 'INFECTED' }), NOW)).toBe(false);
    expect(isMediaQuarantineRetryEligible(state({ scannerVerdict: 'CLEAN' }), NOW)).toBe(false);
  });

  it('stops retry eligibility once the attempt cap is reached', () => {
    expect(
      isMediaQuarantineRetryEligible(
        state({ scannerAttemptCount: MEDIA_QUARANTINE_RETRY_MAX_ATTEMPTS }),
        NOW
      )
    ).toBe(false);
  });

  it('rejects invalid counters and future timestamps', () => {
    expect(isMediaQuarantineRetryEligible(state({ scannerAttemptCount: 0 }), NOW)).toBe(false);
    expect(isMediaQuarantineRetryEligible(state({ scannerAttemptCount: 1.5 }), NOW)).toBe(false);
    expect(
      isMediaQuarantineRetryEligible(
        state({ scannerLastAttemptAt: new Date(NOW.getTime() + 1000) }),
        NOW
      )
    ).toBe(false);
  });
});

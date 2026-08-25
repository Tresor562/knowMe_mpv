import { classifyMediaQuarantineRetentionReadiness } from './media-quarantine-retention-readiness';

const empty = {
  expiredQuarantined: 0,
  retryDue: 0,
  retryScheduled: 0,
  maxBackoffRetries: 0,
  nextScheduledRetryAt: null
};

describe('classifyMediaQuarantineRetentionReadiness', () => {
  it('keeps disabled retention explicit', () => {
    expect(classifyMediaQuarantineRetentionReadiness('DISABLED', empty)).toBe('DISABLED');
  });

  it('blocks on failing or stale workers before backlog interpretation', () => {
    expect(classifyMediaQuarantineRetentionReadiness('FAILING', empty)).toBe('BLOCKED_WORKER');
    expect(classifyMediaQuarantineRetentionReadiness('STALE', { ...empty, retryScheduled: 2 })).toBe('BLOCKED_WORKER');
  });

  it('prioritizes retries already at the maximum backoff', () => {
    expect(classifyMediaQuarantineRetentionReadiness('HEALTHY', { ...empty, maxBackoffRetries: 1 })).toBe('BLOCKED_MAX_BACKOFF');
  });

  it('requires action when expired or due purge work exists', () => {
    expect(classifyMediaQuarantineRetentionReadiness('HEALTHY', { ...empty, expiredQuarantined: 1 })).toBe('ACTION_REQUIRED');
    expect(classifyMediaQuarantineRetentionReadiness('HEALTHY', { ...empty, retryDue: 1 })).toBe('ACTION_REQUIRED');
  });

  it('preserves first-run state before interpreting scheduled retries', () => {
    expect(classifyMediaQuarantineRetentionReadiness('AWAITING_FIRST_RUN', { ...empty, retryScheduled: 1 })).toBe('AWAITING_FIRST_RUN');
  });

  it('reports scheduled retries and a clear state distinctly', () => {
    expect(classifyMediaQuarantineRetentionReadiness('HEALTHY', { ...empty, retryScheduled: 1 })).toBe('RETRY_SCHEDULED');
    expect(classifyMediaQuarantineRetentionReadiness('HEALTHY', empty)).toBe('CLEAR');
  });
});

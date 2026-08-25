export type MediaQuarantineRetentionBacklog = {
  expiredQuarantined: number;
  retryDue: number;
  retryScheduled: number;
  maxBackoffRetries: number;
  nextScheduledRetryAt: string | null;
};

export type MediaQuarantineRetentionReadiness =
  | 'DISABLED'
  | 'BLOCKED_WORKER'
  | 'BLOCKED_MAX_BACKOFF'
  | 'ACTION_REQUIRED'
  | 'AWAITING_FIRST_RUN'
  | 'RETRY_SCHEDULED'
  | 'CLEAR';

export function classifyMediaQuarantineRetentionReadiness(
  workerReadiness: string,
  backlog: MediaQuarantineRetentionBacklog
): MediaQuarantineRetentionReadiness {
  if (workerReadiness === 'DISABLED') return 'DISABLED';
  if (workerReadiness === 'FAILING' || workerReadiness === 'STALE') return 'BLOCKED_WORKER';
  if (backlog.maxBackoffRetries > 0) return 'BLOCKED_MAX_BACKOFF';
  if (backlog.expiredQuarantined > 0 || backlog.retryDue > 0) return 'ACTION_REQUIRED';
  if (workerReadiness === 'AWAITING_FIRST_RUN') return 'AWAITING_FIRST_RUN';
  if (backlog.retryScheduled > 0) return 'RETRY_SCHEDULED';
  return 'CLEAR';
}

export const MEDIA_QUARANTINE_RETRY_MAX_ATTEMPTS = 5;
export const MEDIA_QUARANTINE_RETRY_BASE_DELAY_MS = 5 * 60 * 1000;
export const MEDIA_QUARANTINE_RETRY_MAX_DELAY_MS = 6 * 60 * 60 * 1000;

export type MediaQuarantineRetryState = {
  status: string;
  scannerVerdict: string;
  deletedAt: Date | null;
  scannerAttemptCount: number;
  scannerLastAttemptAt: Date | null;
};

export function getMediaQuarantineRetryDelayMs(attemptCount: number) {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) {
    return MEDIA_QUARANTINE_RETRY_MAX_DELAY_MS;
  }

  const exponent = Math.max(0, attemptCount - 1);
  return Math.min(
    MEDIA_QUARANTINE_RETRY_BASE_DELAY_MS * 2 ** exponent,
    MEDIA_QUARANTINE_RETRY_MAX_DELAY_MS
  );
}

export function isMediaQuarantineRetryEligible(
  state: MediaQuarantineRetryState,
  now: Date
) {
  if (state.status !== 'QUARANTINED') return false;
  if (state.scannerVerdict !== 'UNAVAILABLE') return false;
  if (state.deletedAt) return false;
  if (!Number.isInteger(state.scannerAttemptCount)) return false;
  if (state.scannerAttemptCount < 1) return false;
  if (state.scannerAttemptCount >= MEDIA_QUARANTINE_RETRY_MAX_ATTEMPTS) return false;
  if (!state.scannerLastAttemptAt) return false;

  const lastAttemptMs = state.scannerLastAttemptAt.getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(lastAttemptMs) || !Number.isFinite(nowMs)) return false;
  if (lastAttemptMs > nowMs) return false;

  return nowMs - lastAttemptMs >= getMediaQuarantineRetryDelayMs(state.scannerAttemptCount);
}

import { createHash } from 'crypto';
import { ProfileCircleTransportChannel } from './profile-circle-notification-endpoints.service';

export type ProfileCircleNotificationPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'CRITICAL';

export type ProfileCircleNotificationRoute = {
  channel: ProfileCircleTransportChannel;
  provider: string;
  priority: ProfileCircleNotificationPriority;
};

const PRIORITY_RANK: Record<ProfileCircleNotificationPriority, number> = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  CRITICAL: 3
};

export function priorityAtLeast(
  actual: ProfileCircleNotificationPriority,
  minimum: ProfileCircleNotificationPriority
) {
  return PRIORITY_RANK[actual] >= PRIORITY_RANK[minimum];
}

export function selectFirstAvailableRoute(input: {
  candidates: ProfileCircleNotificationRoute[];
  unavailableProviders: Set<string>;
  disabledChannels: Set<ProfileCircleTransportChannel>;
}) {
  return (
    input.candidates.find(
      (candidate) =>
        !input.unavailableProviders.has(candidate.provider) &&
        !input.disabledChannels.has(candidate.channel)
    ) ?? null
  );
}

export function retryDelayMs(input: {
  attempt: number;
  idempotencyKey: string;
  baseMs?: number;
  maximumMs?: number;
}) {
  const attempt = Math.max(1, Math.trunc(input.attempt));
  const baseMs = Math.max(1_000, input.baseMs ?? 5_000);
  const maximumMs = Math.max(baseMs, input.maximumMs ?? 6 * 60 * 60_000);
  const exponential = Math.min(maximumMs, baseMs * 2 ** Math.min(16, attempt - 1));
  const digest = createHash('sha256')
    .update(`${input.idempotencyKey}:${attempt}`)
    .digest();
  const jitterRatio = digest.readUInt16BE(0) / 65_535;
  const jitter = Math.trunc(exponential * 0.25 * jitterRatio);
  return Math.min(maximumMs, exponential + jitter);
}

export function nextRetryAt(input: {
  now: Date;
  attempt: number;
  idempotencyKey: string;
  baseMs?: number;
  maximumMs?: number;
}) {
  return new Date(
    input.now.getTime() +
      retryDelayMs({
        attempt: input.attempt,
        idempotencyKey: input.idempotencyKey,
        baseMs: input.baseMs,
        maximumMs: input.maximumMs
      })
  );
}

export function normalizeProviderError(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 120);
  }
  return 'UNKNOWN_PROVIDER_ERROR';
}

export function isMandatoryPriority(priority: ProfileCircleNotificationPriority) {
  return priority === 'CRITICAL';
}

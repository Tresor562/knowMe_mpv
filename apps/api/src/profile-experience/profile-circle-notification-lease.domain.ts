import { randomUUID } from 'crypto';

export type NotificationSchedulerLease = {
  key: string;
  ownerId: string;
  leaseToken: string;
  acquiredAt: Date;
  heartbeatAt: Date;
  expiresAt: Date;
};

export function createLeaseToken(ownerId: string) {
  return `${ownerId}:${randomUUID()}`;
}

export function leaseIsExpired(
  lease: Pick<NotificationSchedulerLease, 'expiresAt'>,
  now = new Date()
) {
  return lease.expiresAt.getTime() <= now.getTime();
}

export function nextLeaseExpiry(now: Date, ttlMs: number) {
  const boundedTtl = Math.min(
    30 * 60_000,
    Math.max(15_000, Math.trunc(ttlMs))
  );
  return new Date(now.getTime() + boundedTtl);
}

export function leaseOwnedBy(
  lease: Pick<NotificationSchedulerLease, 'ownerId' | 'leaseToken'>,
  ownerId: string,
  leaseToken: string
) {
  return lease.ownerId === ownerId && lease.leaseToken === leaseToken;
}

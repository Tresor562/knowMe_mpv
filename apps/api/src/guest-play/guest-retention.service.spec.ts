import { GUEST_PURGE_GRACE_MS, guestPurgeCutoff, GuestRetentionService } from './guest-retention.service';

describe('GuestRetentionService', () => {
  it('uses a one-hour safety grace before physical deletion', () => {
    const now = new Date('2026-08-22T20:00:00.000Z');
    expect(guestPurgeCutoff(now).toISOString()).toBe('2026-08-22T19:00:00.000Z');
    expect(GUEST_PURGE_GRACE_MS).toBe(60 * 60 * 1000);
  });

  it('physically deletes only rows whose expiry is at or before the grace cutoff', async () => {
    const deleteMany = jest.fn(async () => ({ count: 3 }));
    const service = new GuestRetentionService({
      guestIdentity: { deleteMany }
    } as any);
    const now = new Date('2026-08-22T20:00:00.000Z');

    await expect(service.purgeExpired(now)).resolves.toEqual({
      deleted: 3,
      cutoff: '2026-08-22T19:00:00.000Z',
      graceSeconds: 3600
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lte: new Date('2026-08-22T19:00:00.000Z') }
      }
    });
  });

  it('is naturally idempotent when no expired rows remain', async () => {
    const deleteMany = jest.fn(async () => ({ count: 0 }));
    const service = new GuestRetentionService({
      guestIdentity: { deleteMany }
    } as any);

    await expect(service.purgeExpired(new Date('2026-08-22T20:00:00.000Z'))).resolves.toEqual(expect.objectContaining({
      deleted: 0
    }));
  });
});

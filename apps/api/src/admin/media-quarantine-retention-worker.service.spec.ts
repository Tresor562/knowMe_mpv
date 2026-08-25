import { ConfigService } from '@nestjs/config';
import { MediaQuarantineRetentionWorkerService } from './media-quarantine-retention-worker.service';

describe('MediaQuarantineRetentionWorkerService', () => {
  const now = new Date('2026-08-25T12:00:00.000Z');

  function setup(env: Record<string, string> = {}) {
    const prisma = {
      mediaAsset: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn()
      }
    } as any;
    const storage = { delete: jest.fn() } as any;
    const audit = { record: jest.fn() } as any;
    const config = new ConfigService(env);
    const service = new MediaQuarantineRetentionWorkerService(prisma, config, storage, audit);
    return { service, prisma, storage, audit };
  }

  function candidate(overrides: Record<string, unknown> = {}) {
    return {
      id: 'asset-1',
      ownerId: 'user-1',
      storageKey: 'asset-1.bin',
      scannerVerdict: 'INFECTED',
      status: 'QUARANTINED',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      retentionPurgeAttemptCount: 0,
      retentionPurgeNextAttemptAt: null,
      ...overrides
    };
  }

  const configured = {
    NODE_ENV: 'test',
    MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS: '30',
    MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS: '7'
  };

  it('reports DISABLED outside production when no retention policy is configured', () => {
    const { service } = setup({ NODE_ENV: 'test' });
    expect(service.getSnapshot(now)).toEqual({
      enabled: false,
      running: false,
      readiness: 'DISABLED',
      intervalMs: 300000,
      batchSize: 25,
      infectedRetentionDays: null,
      unavailableRetentionDays: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastResult: null
    });
  });

  it('reports zero backlog without querying data when retention is disabled', async () => {
    const { service, prisma } = setup({ NODE_ENV: 'test' });
    await expect(service.getOperationalSnapshot(now)).resolves.toEqual(expect.objectContaining({
      readiness: 'DISABLED',
      backlog: {
        expiredQuarantined: 0,
        retryDue: 0,
        retryScheduled: 0,
        maxBackoffRetries: 0,
        nextScheduledRetryAt: null
      }
    }));
    expect(prisma.mediaAsset.count).not.toHaveBeenCalled();
  });

  it('reports bounded persisted purge backlog telemetry for operators', async () => {
    const { service, prisma } = setup(configured);
    prisma.mediaAsset.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    prisma.mediaAsset.findFirst.mockResolvedValue({
      retentionPurgeNextAttemptAt: new Date('2026-08-25T13:00:00.000Z')
    });

    await expect(service.getOperationalSnapshot(now)).resolves.toEqual(expect.objectContaining({
      readiness: 'AWAITING_FIRST_RUN',
      backlog: {
        expiredQuarantined: 2,
        retryDue: 1,
        retryScheduled: 3,
        maxBackoffRetries: 1,
        nextScheduledRetryAt: '2026-08-25T13:00:00.000Z'
      }
    }));
    expect(prisma.mediaAsset.count).toHaveBeenCalledTimes(4);
    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledTimes(1);
  });

  it('reports AWAITING_FIRST_RUN for a configured worker before its first pass', () => {
    const { service } = setup(configured);
    expect(service.getSnapshot(now)).toEqual(expect.objectContaining({
      enabled: true,
      running: false,
      readiness: 'AWAITING_FIRST_RUN',
      infectedRetentionDays: 30,
      unavailableRetentionDays: 7
    }));
  });

  it('does nothing outside production when no retention policy is configured', async () => {
    const { service, prisma } = setup({ NODE_ENV: 'test' });
    await expect(service.processExpiredBatch(now)).resolves.toEqual({ considered: 0, purged: 0, failed: 0 });
    expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled();
  });

  it('fails closed in production when retention policy is incomplete', async () => {
    const { service } = setup({
      NODE_ENV: 'production',
      MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS: '30'
    });
    await expect(service.processExpiredBatch(now)).rejects.toThrow('retention policy must be fully configured');
    expect(() => service.getSnapshot(now)).toThrow('retention policy must be fully configured');
  });

  it('rejects non-canonical retention values', async () => {
    const { service } = setup({
      NODE_ENV: 'production',
      MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS: '030',
      MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS: '7'
    });
    await expect(service.processExpiredBatch(now)).rejects.toThrow('canonical integer');
  });

  it('claims an expired quarantined object and persists a five-minute retry reservation before deleting bytes', async () => {
    const { service, prisma, storage, audit } = setup(configured);
    prisma.mediaAsset.findMany.mockResolvedValue([candidate()]);
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });
    prisma.mediaAsset.deleteMany.mockResolvedValue({ count: 1 });
    storage.delete.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);

    await expect(service.processExpiredBatch(now)).resolves.toEqual({ considered: 1, purged: 1, failed: 0 });
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PURGING',
          retentionPurgeAttemptCount: { increment: 1 },
          retentionPurgeLastAttemptAt: now,
          retentionPurgeNextAttemptAt: new Date('2026-08-25T12:05:00.000Z')
        })
      })
    );
    expect(storage.delete).toHaveBeenCalledWith('asset-1.bin');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MEDIA_QUARANTINE_RETENTION_OBJECT_DELETED', entityId: 'asset-1' })
    );
    expect(prisma.mediaAsset.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'asset-1', status: 'PURGING' }) })
    );
  });

  it('does not delete bytes when the quarantine claim loses a race', async () => {
    const { service, prisma, storage } = setup(configured);
    prisma.mediaAsset.findMany.mockResolvedValue([
      candidate({
        id: 'asset-race',
        storageKey: 'asset-race.bin',
        scannerVerdict: 'UNAVAILABLE',
        createdAt: new Date('2026-08-01T00:00:00.000Z')
      })
    ]);
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processExpiredBatch(now)).resolves.toEqual({ considered: 1, purged: 0, failed: 0 });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('reclaims an eligible PURGING row and applies exponential retry backoff', async () => {
    const { service, prisma, storage } = setup(configured);
    prisma.mediaAsset.findMany.mockResolvedValue([
      candidate({
        id: 'asset-resume',
        storageKey: 'asset-resume.bin',
        status: 'PURGING',
        retentionPurgeAttemptCount: 3,
        retentionPurgeNextAttemptAt: new Date('2026-08-25T11:59:00.000Z')
      })
    ]);
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });
    prisma.mediaAsset.deleteMany.mockResolvedValue({ count: 1 });
    storage.delete.mockResolvedValue(undefined);

    await expect(service.processExpiredBatch(now)).resolves.toEqual({ considered: 1, purged: 1, failed: 0 });
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'asset-resume', status: 'PURGING' }),
        data: expect.objectContaining({
          retentionPurgeAttemptCount: { increment: 1 },
          retentionPurgeNextAttemptAt: new Date('2026-08-25T12:40:00.000Z')
        })
      })
    );
    expect(storage.delete).toHaveBeenCalledWith('asset-resume.bin');
  });

  it('keeps a failed purge in PURGING with its persisted retry reservation', async () => {
    const { service, prisma, storage } = setup(configured);
    prisma.mediaAsset.findMany.mockResolvedValue([candidate()]);
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });
    storage.delete.mockRejectedValue(new Error('object store unavailable'));

    await expect(service.processExpiredBatch(now)).resolves.toEqual({ considered: 1, purged: 0, failed: 1 });
    expect(prisma.mediaAsset.deleteMany).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PURGING',
          retentionPurgeNextAttemptAt: new Date('2026-08-25T12:05:00.000Z')
        })
      })
    );
  });

  it('caps retry backoff at 24 hours', async () => {
    const { service, prisma } = setup(configured);
    prisma.mediaAsset.findMany.mockResolvedValue([
      candidate({
        id: 'asset-old-failure',
        status: 'PURGING',
        retentionPurgeAttemptCount: 20,
        retentionPurgeNextAttemptAt: null
      })
    ]);
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 0 });

    await service.processExpiredBatch(now);

    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          retentionPurgeNextAttemptAt: new Date('2026-08-26T12:00:00.000Z')
        })
      })
    );
  });
});

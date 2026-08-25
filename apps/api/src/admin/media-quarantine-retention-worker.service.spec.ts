import { ConfigService } from '@nestjs/config';
import { MediaQuarantineRetentionWorkerService } from './media-quarantine-retention-worker.service';

describe('MediaQuarantineRetentionWorkerService', () => {
  const now = new Date('2026-08-25T12:00:00.000Z');

  function setup(env: Record<string, string> = {}) {
    const prisma = {
      mediaAsset: {
        findMany: jest.fn(),
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

  it('reports AWAITING_FIRST_RUN for a configured worker before its first pass', () => {
    const { service } = setup({
      NODE_ENV: 'test',
      MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS: '30',
      MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS: '7'
    });
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

  it('claims an expired quarantined object before deleting bytes and metadata', async () => {
    const { service, prisma, storage, audit } = setup({
      NODE_ENV: 'test',
      MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS: '30',
      MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS: '7'
    });
    prisma.mediaAsset.findMany.mockResolvedValue([
      {
        id: 'asset-1',
        ownerId: 'user-1',
        storageKey: 'asset-1.bin',
        scannerVerdict: 'INFECTED',
        status: 'QUARANTINED',
        createdAt: new Date('2026-07-01T00:00:00.000Z')
      }
    ]);
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });
    prisma.mediaAsset.deleteMany.mockResolvedValue({ count: 1 });
    storage.delete.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);

    await expect(service.processExpiredBatch(now)).resolves.toEqual({ considered: 1, purged: 1, failed: 0 });
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PURGING' } })
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
    const { service, prisma, storage } = setup({
      NODE_ENV: 'test',
      MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS: '30',
      MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS: '7'
    });
    prisma.mediaAsset.findMany.mockResolvedValue([
      {
        id: 'asset-race',
        ownerId: 'user-1',
        storageKey: 'asset-race.bin',
        scannerVerdict: 'UNAVAILABLE',
        status: 'QUARANTINED',
        createdAt: new Date('2026-08-01T00:00:00.000Z')
      }
    ]);
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processExpiredBatch(now)).resolves.toEqual({ considered: 1, purged: 0, failed: 0 });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('resumes a previously claimed PURGING row idempotently after a crash', async () => {
    const { service, prisma, storage } = setup({
      NODE_ENV: 'test',
      MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS: '30',
      MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS: '7'
    });
    prisma.mediaAsset.findMany.mockResolvedValue([
      {
        id: 'asset-resume',
        ownerId: 'user-1',
        storageKey: 'asset-resume.bin',
        scannerVerdict: 'INFECTED',
        status: 'PURGING',
        createdAt: new Date('2026-07-01T00:00:00.000Z')
      }
    ]);
    prisma.mediaAsset.deleteMany.mockResolvedValue({ count: 1 });
    storage.delete.mockResolvedValue(undefined);

    await expect(service.processExpiredBatch(now)).resolves.toEqual({ considered: 1, purged: 1, failed: 0 });
    expect(prisma.mediaAsset.updateMany).not.toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalledWith('asset-resume.bin');
  });
});

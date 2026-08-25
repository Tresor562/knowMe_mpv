import { MediaQuarantineRetryWorkerService } from './media-quarantine-retry-worker.service';

describe('MediaQuarantineRetryWorkerService', () => {
  const now = new Date('2026-08-25T12:00:00.000Z');

  function setup(configValues: Record<string, string | undefined> = {}) {
    const prisma = { mediaAsset: { findMany: jest.fn() } };
    const config = { get: jest.fn((key: string) => configValues[key]) };
    const quarantine = { rescanUnavailable: jest.fn().mockResolvedValue({}) };
    const service = new MediaQuarantineRetryWorkerService(prisma as never, config as never, quarantine as never);
    return { service, prisma, quarantine };
  }

  it('reports a bounded disabled snapshot without exposing asset data', () => {
    const { service } = setup();
    expect(service.getSnapshot(now)).toEqual({
      enabled: false,
      running: false,
      readiness: 'DISABLED',
      intervalMs: 60_000,
      batchSize: 10,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastResult: null
    });
  });

  it('reports awaiting-first-run when automatic retry is enabled but has not run yet', () => {
    const { service } = setup({
      MEDIA_QUARANTINE_RETRY_ENABLED: 'true',
      MEDIA_QUARANTINE_RETRY_INTERVAL_MS: '120000',
      MEDIA_QUARANTINE_RETRY_BATCH_SIZE: '4'
    });
    expect(service.getSnapshot(now)).toEqual(expect.objectContaining({
      enabled: true,
      running: false,
      readiness: 'AWAITING_FIRST_RUN',
      intervalMs: 120_000,
      batchSize: 4,
      lastAttemptAt: null,
      lastResult: null
    }));
  });

  it('processes only policy-eligible assets and uses a null system actor', async () => {
    const { service, prisma, quarantine } = setup({ MEDIA_QUARANTINE_RETRY_BATCH_SIZE: '2' });
    prisma.mediaAsset.findMany.mockResolvedValue([
      { id: 'eligible-1', status: 'QUARANTINED', scannerVerdict: 'UNAVAILABLE', deletedAt: null, scannerAttemptCount: 1, scannerLastAttemptAt: new Date(now.getTime() - 5 * 60 * 1000) },
      { id: 'too-soon', status: 'QUARANTINED', scannerVerdict: 'UNAVAILABLE', deletedAt: null, scannerAttemptCount: 2, scannerLastAttemptAt: new Date(now.getTime() - 5 * 60 * 1000) },
      { id: 'eligible-2', status: 'QUARANTINED', scannerVerdict: 'UNAVAILABLE', deletedAt: null, scannerAttemptCount: 2, scannerLastAttemptAt: new Date(now.getTime() - 10 * 60 * 1000) }
    ]);

    await expect(service.processEligibleBatch(now)).resolves.toEqual({ attempted: 2, succeeded: 2, failed: 0 });
    expect(quarantine.rescanUnavailable).toHaveBeenNthCalledWith(1, null, 'eligible-1', 'AUTOMATIC');
    expect(quarantine.rescanUnavailable).toHaveBeenNthCalledWith(2, null, 'eligible-2', 'AUTOMATIC');
  });

  it('contains one failed asset and continues the bounded batch', async () => {
    const { service, prisma, quarantine } = setup({ MEDIA_QUARANTINE_RETRY_BATCH_SIZE: '2' });
    prisma.mediaAsset.findMany.mockResolvedValue([
      { id: 'a', status: 'QUARANTINED', scannerVerdict: 'UNAVAILABLE', deletedAt: null, scannerAttemptCount: 1, scannerLastAttemptAt: new Date(now.getTime() - 5 * 60 * 1000) },
      { id: 'b', status: 'QUARANTINED', scannerVerdict: 'UNAVAILABLE', deletedAt: null, scannerAttemptCount: 1, scannerLastAttemptAt: new Date(now.getTime() - 5 * 60 * 1000) }
    ]);
    quarantine.rescanUnavailable.mockRejectedValueOnce(new Error('scanner outage'));

    await expect(service.processEligibleBatch(now)).resolves.toEqual({ attempted: 2, succeeded: 1, failed: 1 });
    expect(quarantine.rescanUnavailable).toHaveBeenCalledTimes(2);
  });

  it('never scans more than the configured batch size', async () => {
    const { service, prisma, quarantine } = setup({ MEDIA_QUARANTINE_RETRY_BATCH_SIZE: '1' });
    prisma.mediaAsset.findMany.mockResolvedValue([
      { id: 'a', status: 'QUARANTINED', scannerVerdict: 'UNAVAILABLE', deletedAt: null, scannerAttemptCount: 1, scannerLastAttemptAt: new Date(now.getTime() - 5 * 60 * 1000) },
      { id: 'b', status: 'QUARANTINED', scannerVerdict: 'UNAVAILABLE', deletedAt: null, scannerAttemptCount: 1, scannerLastAttemptAt: new Date(now.getTime() - 5 * 60 * 1000) }
    ]);

    await service.processEligibleBatch(now);
    expect(quarantine.rescanUnavailable).toHaveBeenCalledTimes(1);
  });

  it('uses conservative bounded defaults for malformed interval and batch settings', async () => {
    const { service, prisma } = setup({ MEDIA_QUARANTINE_RETRY_INTERVAL_MS: '01', MEDIA_QUARANTINE_RETRY_BATCH_SIZE: '1000' });
    prisma.mediaAsset.findMany.mockResolvedValue([]);
    await service.processEligibleBatch(now);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 40 }));
  });
});

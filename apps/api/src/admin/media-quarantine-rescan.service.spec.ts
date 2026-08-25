import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { MediaQuarantineOpsService } from './media-quarantine-ops.service';

describe('MediaQuarantineOpsService rescan', () => {
  const body = Buffer.from('known quarantined payload');
  const sha256 = createHash('sha256').update(body).digest('hex');

  function setup() {
    const prisma = {
      mediaAsset: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      }
    };
    const storage = { get: jest.fn().mockResolvedValue(body) };
    const scanner = {
      scan: jest.fn().mockResolvedValue({ verdict: 'CLEAN', reference: 'provider:clean' })
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new MediaQuarantineOpsService(
      prisma as never,
      storage as never,
      scanner as never,
      audit as never
    );
    prisma.mediaAsset.findFirst.mockResolvedValue({
      id: 'asset-1',
      ownerId: 'owner-1',
      storageKey: 'private/asset-1',
      detectedMime: 'image/png',
      sha256
    });
    return { service, prisma, storage, scanner, audit };
  }

  it('releases only an unavailable quarantined asset after a clean rescan', async () => {
    const { service, prisma, scanner, audit } = setup();

    await expect(service.rescanUnavailable('admin-1', 'asset-1')).resolves.toEqual({
      assetId: 'asset-1',
      status: 'AVAILABLE',
      scannerVerdict: 'CLEAN'
    });
    expect(scanner.scan).toHaveBeenCalledWith(body, { mimeType: 'image/png' });
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'asset-1',
        status: 'QUARANTINED',
        scannerVerdict: 'UNAVAILABLE',
        deletedAt: null
      }),
      data: expect.objectContaining({ status: 'AVAILABLE', scannerVerdict: 'CLEAN' })
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'admin-1',
      action: 'MEDIA_QUARANTINE_RESCAN',
      entityId: 'asset-1'
    }));
  });

  it('keeps an infected rescan quarantined', async () => {
    const { service, prisma, scanner } = setup();
    scanner.scan.mockResolvedValueOnce({ verdict: 'INFECTED', reference: 'provider:infected' });

    await expect(service.rescanUnavailable('admin-1', 'asset-1')).resolves.toEqual({
      assetId: 'asset-1',
      status: 'QUARANTINED',
      scannerVerdict: 'INFECTED'
    });
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'QUARANTINED', scannerVerdict: 'INFECTED' })
    }));
  });

  it('keeps a scanner outage quarantined', async () => {
    const { service, prisma, scanner } = setup();
    scanner.scan.mockResolvedValueOnce({
      verdict: 'UNAVAILABLE',
      reference: 'EXTERNAL_SCANNER_UNAVAILABLE'
    });

    await expect(service.rescanUnavailable('admin-1', 'asset-1')).resolves.toEqual({
      assetId: 'asset-1',
      status: 'QUARANTINED',
      scannerVerdict: 'UNAVAILABLE'
    });
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'QUARANTINED', scannerVerdict: 'UNAVAILABLE' })
    }));
  });

  it('never rescans infected, available, deleted or otherwise ineligible assets', async () => {
    const { service, prisma, storage, scanner } = setup();
    prisma.mediaAsset.findFirst.mockResolvedValueOnce(null);

    await expect(service.rescanUnavailable('admin-1', 'asset-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.get).not.toHaveBeenCalled();
    expect(scanner.scan).not.toHaveBeenCalled();
  });

  it('fails closed when stored bytes no longer match the persisted sha256', async () => {
    const { service, prisma, scanner, audit } = setup();
    prisma.mediaAsset.findFirst.mockResolvedValueOnce({
      id: 'asset-1',
      ownerId: 'owner-1',
      storageKey: 'private/asset-1',
      detectedMime: 'image/png',
      sha256: '0'.repeat(64)
    });

    await expect(service.rescanUnavailable('admin-1', 'asset-1')).rejects.toBeInstanceOf(ConflictException);
    expect(scanner.scan).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.updateMany).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'MEDIA_QUARANTINE_RESCAN_BLOCKED',
      metadata: { reason: 'STORAGE_INTEGRITY_MISMATCH' }
    }));
  });

  it('fails on a concurrent state change instead of overwriting it', async () => {
    const { service, prisma, audit } = setup();
    prisma.mediaAsset.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.rescanUnavailable('admin-1', 'asset-1')).rejects.toBeInstanceOf(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });
});

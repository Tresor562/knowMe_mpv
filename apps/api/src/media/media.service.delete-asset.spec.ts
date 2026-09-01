import { MediaService } from './media.service';

describe('MediaService single-media deletion privacy boundary', () => {
  function harness() {
    const asset = {
      id: 'asset-1',
      ownerId: 'user-1',
      storageKey: 'private/asset-1.bin',
      deletedAt: null
    };
    const prisma: any = {
      mediaAsset: {
        findFirst: jest.fn().mockResolvedValue(asset),
        update: jest.fn().mockResolvedValue({ ...asset, status: 'DELETED', deletedAt: new Date() })
      },
      mediaDownloadGrant: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      mediaAccessGrant: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      $transaction: jest.fn().mockResolvedValue([])
    };
    const storage = {
      delete: jest.fn(),
      storageDriver: jest.fn().mockReturnValue('local')
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const scanner = { scan: jest.fn() };
    const service = new MediaService(prisma as never, audit as never, storage as never, scanner as never);
    return { service, prisma, storage, audit };
  }

  it('keeps durable metadata and grants untouched when provider deletion fails', async () => {
    const { service, prisma, storage, audit } = harness();
    storage.delete.mockRejectedValue(new Error('provider unavailable'));

    await expect(service.deleteAsset('user-1', 'asset-1')).rejects.toThrow('provider unavailable');

    expect(storage.delete).toHaveBeenCalledWith('private/asset-1.bin');
    expect(prisma.mediaDownloadGrant.deleteMany).not.toHaveBeenCalled();
    expect(prisma.mediaAccessGrant.deleteMany).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('removes provider bytes before revoking grants and tombstoning metadata', async () => {
    const { service, prisma, storage, audit } = harness();
    storage.delete.mockResolvedValue(undefined);

    await expect(service.deleteAsset('user-1', 'asset-1')).resolves.toEqual({ deleted: true });

    expect(storage.delete).toHaveBeenCalledWith('private/asset-1.bin');
    expect(prisma.mediaDownloadGrant.deleteMany).toHaveBeenCalledWith({ where: { assetId: 'asset-1' } });
    expect(prisma.mediaAccessGrant.deleteMany).toHaveBeenCalledWith({ where: { assetId: 'asset-1' } });
    expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { status: 'DELETED', deletedAt: expect.any(Date) }
    });
    expect(storage.delete.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.mediaDownloadGrant.deleteMany.mock.invocationCallOrder[0]
    );
    expect(storage.delete.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.mediaAsset.update.mock.invocationCallOrder[0]
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        action: 'MEDIA_DELETE',
        entityId: 'asset-1',
        targetAccountId: 'user-1'
      })
    );
  });

  it('does not report or audit success when database finalization fails after provider deletion', async () => {
    const { service, prisma, storage, audit } = harness();
    storage.delete.mockResolvedValue(undefined);
    prisma.$transaction.mockRejectedValue(new Error('database unavailable'));

    await expect(service.deleteAsset('user-1', 'asset-1')).rejects.toThrow('database unavailable');

    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audit.record).not.toHaveBeenCalled();
  });
});

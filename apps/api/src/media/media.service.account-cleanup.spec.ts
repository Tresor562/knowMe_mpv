import { MediaService } from './media.service';

describe('MediaService account cleanup privacy boundary', () => {
  function harness(assets: Array<{ id: string; storageKey: string }>) {
    const prisma = {
      mediaAsset: {
        findMany: jest.fn().mockResolvedValue(assets),
        deleteMany: jest.fn().mockResolvedValue({ count: assets.length })
      },
      mediaDownloadGrant: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      mediaAccessGrant: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      mediaUploadSession: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      $transaction: jest.fn().mockResolvedValue([])
    };
    const storage = {
      delete: jest.fn()
    };
    const audit = { record: jest.fn() };
    const scanner = { scan: jest.fn() };
    const service = new MediaService(prisma as never, audit as never, storage as never, scanner as never);
    return { service, prisma, storage };
  }

  it('fails account cleanup before metadata removal when the private provider cannot delete an object', async () => {
    const { service, prisma, storage } = harness([
      { id: 'asset-1', storageKey: 'asset-1.bin' },
      { id: 'asset-2', storageKey: 'asset-2.bin' }
    ]);
    storage.delete
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('provider unavailable'));

    await expect(service.cleanupAccount('user-1')).rejects.toThrow('provider unavailable');

    expect(storage.delete).toHaveBeenNthCalledWith(1, 'asset-1.bin');
    expect(storage.delete).toHaveBeenNthCalledWith(2, 'asset-2.bin');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.mediaDownloadGrant.deleteMany).not.toHaveBeenCalled();
    expect(prisma.mediaAccessGrant.deleteMany).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.deleteMany).not.toHaveBeenCalled();
    expect(prisma.mediaUploadSession.deleteMany).not.toHaveBeenCalled();
  });

  it('removes database media metadata only after every private object deletion succeeds', async () => {
    const { service, prisma, storage } = harness([
      { id: 'asset-1', storageKey: 'asset-1.bin' },
      { id: 'asset-2', storageKey: 'asset-2.bin' }
    ]);
    storage.delete.mockResolvedValue(undefined);

    await service.cleanupAccount('user-1');

    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(prisma.mediaDownloadGrant.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.mediaAccessGrant.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.mediaAsset.deleteMany).toHaveBeenCalledWith({ where: { ownerId: 'user-1' } });
    expect(prisma.mediaUploadSession.deleteMany).toHaveBeenCalledWith({ where: { ownerId: 'user-1' } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

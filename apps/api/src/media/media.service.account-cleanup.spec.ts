import { createHash } from 'crypto';
import { MediaService } from './media.service';

describe('MediaService account cleanup privacy boundary', () => {
  function harness(assets: Array<{ id: string; storageKey: string }>) {
    const prisma: any = {
      mediaAsset: {
        findMany: jest.fn().mockResolvedValue(assets),
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: assets.length })
      },
      mediaDownloadGrant: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      mediaAccessGrant: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      mediaUploadSession: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'deletion-marker' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      user: { findUnique: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'user-1' }])
    };
    prisma.$transaction = jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: typeof prisma) => unknown)(prisma);
      return Promise.all(arg as Promise<unknown>[]);
    });

    const storage = {
      put: jest.fn(),
      delete: jest.fn(),
      storageDriver: jest.fn().mockReturnValue('local')
    };
    const audit = { record: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    const scanner = { scan: jest.fn() };
    const service = new MediaService(prisma as never, audit as never, storage as never, scanner as never);
    return { service, prisma, storage, audit };
  }

  function configureUpload(prisma: any, storage: any, token = 'upload-token') {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    prisma.mediaUploadSession.findUnique.mockResolvedValue({
      id: 'session-1',
      ownerId: 'user-1',
      tokenHash: createHash('sha256').update(token).digest('hex'),
      purpose: 'POST_ATTACHMENT',
      visibility: 'PRIVATE',
      conversationId: null,
      maxBytes: 1024,
      allowedMime: ['image/png'],
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null
    });
    prisma.mediaAsset.aggregate = jest.fn().mockResolvedValue({ _sum: { size: 0 } });
    prisma.mediaUploadSession.findFirst.mockResolvedValue(null);
    storage.put.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    prisma.mediaAsset.create.mockResolvedValue({
      id: 'asset-1',
      ownerId: 'user-1',
      storageKey: 'opaque.png',
      purpose: 'POST_ATTACHMENT',
      detectedMime: 'image/png',
      size: buffer.length,
      status: 'AVAILABLE'
    });
    return { token, buffer };
  }

  it('installs a durable deletion marker before provider cleanup begins', async () => {
    const { service, prisma, storage } = harness([{ id: 'asset-1', storageKey: 'asset-1.bin' }]);
    storage.delete.mockResolvedValue(undefined);

    await service.cleanupAccount('user-1');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.mediaUploadSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 'user-1',
        purpose: '__ACCOUNT_DELETION_MEDIA_LOCK__',
        maxBytes: 0,
        consumedAt: expect.any(Date)
      })
    });
    expect(prisma.mediaUploadSession.create.mock.invocationCallOrder[0]).toBeLessThan(
      storage.delete.mock.invocationCallOrder[0]
    );
    expect(prisma.mediaUploadSession.deleteMany).toHaveBeenCalledWith({
      where: {
        ownerId: 'user-1',
        purpose: { not: '__ACCOUNT_DELETION_MEDIA_LOCK__' }
      }
    });
  });

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
    expect(prisma.mediaDownloadGrant.deleteMany).not.toHaveBeenCalled();
    expect(prisma.mediaAccessGrant.deleteMany).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.deleteMany).not.toHaveBeenCalled();
    expect(prisma.mediaUploadSession.deleteMany).not.toHaveBeenCalled();
    expect(prisma.mediaUploadSession.create).toHaveBeenCalledTimes(1);
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
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('blocks an in-flight completion after the deletion marker wins the user-row lock', async () => {
    const { service, prisma, storage } = harness([]);
    const token = 'upload-token';
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    prisma.mediaUploadSession.findUnique.mockResolvedValue({
      id: 'session-1',
      ownerId: 'user-1',
      tokenHash: createHash('sha256').update(token).digest('hex'),
      purpose: 'POST_ATTACHMENT',
      visibility: 'PRIVATE',
      conversationId: null,
      maxBytes: 1024,
      allowedMime: ['image/png'],
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null
    });
    prisma.mediaAsset.aggregate = jest.fn().mockResolvedValue({ _sum: { size: 0 } });
    prisma.mediaUploadSession.findFirst.mockResolvedValue({ id: 'deletion-marker' });
    storage.delete.mockResolvedValue(undefined);

    await expect(
      service.completeUpload('user-1', 'session-1', token, {
        buffer,
        size: buffer.length,
        mimetype: 'image/png',
        originalname: 'avatar.png'
      } as Express.Multer.File)
    ).rejects.toThrow('La suppression du compte est déjà en cours.');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(storage.put).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('holds the user-row lock through provider write, metadata creation and transactional audit', async () => {
    const { service, prisma, storage, audit } = harness([]);
    const { token, buffer } = configureUpload(prisma, storage);

    await service.completeUpload('user-1', 'session-1', token, {
      buffer,
      size: buffer.length,
      mimetype: 'image/png',
      originalname: 'avatar.png'
    } as Express.Multer.File);

    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(storage.put.mock.invocationCallOrder[0]);
    expect(storage.put.mock.invocationCallOrder[0]).toBeLessThan(prisma.mediaAsset.create.mock.invocationCallOrder[0]);
    expect(prisma.mediaAsset.create.mock.invocationCallOrder[0]).toBeLessThan(audit.record.mock.invocationCallOrder[0]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MEDIA_UPLOAD_COMPLETE', entityId: 'asset-1' }),
      prisma
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('removes the provider object when transactional audit persistence fails', async () => {
    const { service, prisma, storage, audit } = harness([]);
    const { token, buffer } = configureUpload(prisma, storage);
    audit.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.completeUpload('user-1', 'session-1', token, {
        buffer,
        size: buffer.length,
        mimetype: 'image/png',
        originalname: 'avatar.png'
      } as Express.Multer.File)
    ).rejects.toThrow('audit unavailable');

    expect(audit.record).toHaveBeenCalledWith(expect.any(Object), prisma);
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith(expect.stringMatching(/\.png$/));
  });
});

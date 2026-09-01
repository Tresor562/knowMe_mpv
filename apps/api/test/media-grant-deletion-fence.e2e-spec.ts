import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let sequence = 0;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = () => resolvePromise();
  });
  return { promise, resolve };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('KMD-376 media grant deletion fence (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUserAndAsset(label: string) {
    sequence += 1;
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `kmd376-${label}-${sequence}@knowme.test`,
        username: `kmd376_${label}_${sequence}`,
        displayName: `KMD 376 ${label}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const userId = registration.body.user.id as string;
    const asset = await prisma.mediaAsset.create({
      data: {
        ownerId: userId,
        storageKey: `kmd376/${label}-${sequence}.png`,
        originalName: `${label}.png`,
        declaredMime: 'image/png',
        detectedMime: 'image/png',
        size: 12,
        sha256: `${sequence}`.padStart(64, '0'),
        purpose: 'POST_ATTACHMENT',
        visibility: 'PRIVATE',
        status: 'AVAILABLE',
        scannerVerdict: 'CLEAN'
      }
    });
    return { userId, assetId: asset.id };
  }

  it('purges access and download authority in the same tombstone transition', async () => {
    const { userId, assetId } = await createUserAndAsset('purge');

    await prisma.mediaAccessGrant.create({
      data: {
        assetId,
        granteeId: userId,
        grantedBy: userId
      }
    });
    await prisma.mediaDownloadGrant.create({
      data: {
        assetId,
        userId,
        tokenHash: `kmd376-download-${sequence}`,
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    expect(await prisma.mediaAccessGrant.count({ where: { assetId } })).toBe(1);
    expect(await prisma.mediaDownloadGrant.count({ where: { assetId } })).toBe(1);

    await prisma.mediaAsset.update({
      where: { id: assetId },
      data: { status: 'DELETED', deletedAt: new Date() }
    });

    expect(await prisma.mediaAccessGrant.count({ where: { assetId } })).toBe(0);
    expect(await prisma.mediaDownloadGrant.count({ where: { assetId } })).toBe(0);
  });

  it('rejects new access authority after an asset is tombstoned', async () => {
    const { userId, assetId } = await createUserAndAsset('access-block');
    await prisma.mediaAsset.update({
      where: { id: assetId },
      data: { status: 'DELETED', deletedAt: new Date() }
    });

    await expect(
      prisma.mediaAccessGrant.create({
        data: { assetId, granteeId: userId, grantedBy: userId }
      })
    ).rejects.toThrow(/active asset|foreign key|violat/i);

    expect(await prisma.mediaAccessGrant.count({ where: { assetId } })).toBe(0);
  });

  it('rejects new download authority after an asset is tombstoned', async () => {
    const { userId, assetId } = await createUserAndAsset('download-block');
    await prisma.mediaAsset.update({
      where: { id: assetId },
      data: { status: 'DELETED', deletedAt: new Date() }
    });

    await expect(
      prisma.mediaDownloadGrant.create({
        data: {
          assetId,
          userId,
          tokenHash: `kmd376-blocked-download-${sequence}`,
          expiresAt: new Date(Date.now() + 60_000)
        }
      })
    ).rejects.toThrow(/active asset|foreign key|violat/i);

    expect(await prisma.mediaDownloadGrant.count({ where: { assetId } })).toBe(0);
  });

  it('serializes grant-first concurrency so the later tombstone removes the committed grant', async () => {
    const { userId, assetId } = await createUserAndAsset('grant-first-race');
    const grantReady = deferred();
    const releaseGrant = deferred();

    const grantTransaction = prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT 1 FROM "MediaAsset" WHERE "id" = $1 FOR UPDATE',
        assetId
      );
      await tx.mediaAccessGrant.create({
        data: { assetId, granteeId: userId, grantedBy: userId }
      });
      grantReady.resolve();
      await releaseGrant.promise;
    });

    await grantReady.promise;

    let tombstoneSettled = false;
    const tombstone = prisma.mediaAsset
      .update({
        where: { id: assetId },
        data: { status: 'DELETED', deletedAt: new Date() }
      })
      .then(
        (value) => {
          tombstoneSettled = true;
          return value;
        },
        (error) => {
          tombstoneSettled = true;
          throw error;
        }
      );

    await sleep(100);
    expect(tombstoneSettled).toBe(false);

    releaseGrant.resolve();
    await grantTransaction;
    await tombstone;

    expect(await prisma.mediaAccessGrant.count({ where: { assetId } })).toBe(0);
  });

  it('serializes deletion-first concurrency so a waiting grant is rejected after tombstone commit', async () => {
    const { userId, assetId } = await createUserAndAsset('delete-first-race');
    const tombstoneReady = deferred();
    const releaseTombstone = deferred();

    const tombstoneTransaction = prisma.$transaction(async (tx) => {
      await tx.mediaAsset.update({
        where: { id: assetId },
        data: { status: 'DELETED', deletedAt: new Date() }
      });
      tombstoneReady.resolve();
      await releaseTombstone.promise;
    });

    await tombstoneReady.promise;

    let grantSettled = false;
    const grantAttempt = prisma.mediaAccessGrant
      .create({ data: { assetId, granteeId: userId, grantedBy: userId } })
      .then(
        (value) => {
          grantSettled = true;
          return value;
        },
        (error) => {
          grantSettled = true;
          throw error;
        }
      );

    await sleep(100);
    expect(grantSettled).toBe(false);

    releaseTombstone.resolve();
    await tombstoneTransaction;
    await expect(grantAttempt).rejects.toThrow(/active asset|foreign key|violat/i);

    expect(await prisma.mediaAccessGrant.count({ where: { assetId } })).toBe(0);
  });
});

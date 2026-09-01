import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DELETION_FENCE_PURPOSE = '__ACCOUNT_DELETION_MEDIA_LOCK__';

function uploadSessionData(ownerId: string, suffix: string) {
  return {
    ownerId,
    tokenHash: `kmd374-${suffix}-token-hash`,
    purpose: 'POST_ATTACHMENT',
    visibility: 'PRIVATE',
    maxBytes: 1024,
    allowedMime: ['image/png'],
    expiresAt: new Date(Date.now() + 60_000)
  };
}

describe('KMD-373/KMD-374 media account-deletion lifecycle fences (e2e)', () => {
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

  it('removes the retained media lifecycle fence atomically when the owning user is deleted', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'kmd373-fence@knowme.test',
        username: 'kmd373_fence',
        displayName: 'KMD 373 Fence',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const userId = registration.body.user.id as string;

    await prisma.mediaUploadSession.create({
      data: {
        ownerId: userId,
        tokenHash: 'kmd373-fence-token-hash',
        purpose: DELETION_FENCE_PURPOSE,
        visibility: 'PRIVATE',
        maxBytes: 0,
        allowedMime: [],
        expiresAt: new Date('9999-12-31T23:59:59.999Z'),
        consumedAt: new Date()
      }
    });

    expect(
      await prisma.mediaUploadSession.count({ where: { ownerId: userId, purpose: DELETION_FENCE_PURPOSE } })
    ).toBe(1);

    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.mediaUploadSession.count({ where: { ownerId: userId } })).toBe(0);
  });

  it('rejects a new upload session after the account-deletion fence exists', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'kmd374-fenced-create@knowme.test',
        username: 'kmd374_fenced_create',
        displayName: 'KMD 374 Fenced Create',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const userId = registration.body.user.id as string;

    await prisma.mediaUploadSession.create({
      data: {
        ownerId: userId,
        tokenHash: 'kmd374-deletion-fence-token-hash',
        purpose: DELETION_FENCE_PURPOSE,
        visibility: 'PRIVATE',
        maxBytes: 0,
        allowedMime: [],
        expiresAt: new Date('9999-12-31T23:59:59.999Z'),
        consumedAt: new Date()
      }
    });

    await expect(
      prisma.mediaUploadSession.create({ data: uploadSessionData(userId, 'blocked-by-fence') })
    ).rejects.toThrow(/account deletion fence|check constraint|violat/i);

    expect(
      await prisma.mediaUploadSession.count({
        where: { ownerId: userId, purpose: { not: DELETION_FENCE_PURPOSE } }
      })
    ).toBe(0);
  });

  it('rejects an upload session whose owner has already been deleted', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'kmd374-deleted-owner@knowme.test',
        username: 'kmd374_deleted_owner',
        displayName: 'KMD 374 Deleted Owner',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const userId = registration.body.user.id as string;

    await prisma.user.delete({ where: { id: userId } });

    await expect(
      prisma.mediaUploadSession.create({ data: uploadSessionData(userId, 'missing-owner') })
    ).rejects.toThrow(/owner does not exist|foreign key|violat/i);

    expect(await prisma.mediaUploadSession.count({ where: { ownerId: userId } })).toBe(0);
  });
});

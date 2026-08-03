import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe media download governance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accounts: AccountService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    accounts = app.get(AccountService);
    await prisma.userMediaDownloadPreference.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('persists a versioned policy without exporting local cache secrets', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'media-policy@knowme.test',
        username: 'media_policy',
        displayName: 'Media Policy',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const token = registered.body.accessToken as string;
    const userId = registered.body.user.id as string;
    const authorization = { Authorization: `Bearer ${token}` };

    const defaults = await request(app.getHttpServer())
      .get('/media/download-preferences')
      .set(authorization)
      .expect(200);
    expect(defaults.body).toEqual(expect.objectContaining({
      userId,
      wifiKinds: ['IMAGE', 'VIDEO', 'AUDIO', 'FILE'],
      cellularKinds: ['IMAGE'],
      roamingKinds: [],
      backgroundDownloads: false,
      respectDataSaver: true,
      maxCacheMb: 512,
      version: 0,
      persisted: false
    }));

    const legacyExport = await accounts.exportData(userId);
    expect(legacyExport.formatVersion).toBe(6);
    expect(legacyExport.mediaDownloadPolicy).toBeUndefined();

    const saved = await request(app.getHttpServer())
      .put('/media/download-preferences')
      .set(authorization)
      .send({
        wifiKinds: ['IMAGE', 'VIDEO', 'AUDIO'],
        cellularKinds: ['IMAGE', 'AUDIO'],
        roamingKinds: [],
        backgroundDownloads: true,
        respectDataSaver: true,
        maxCacheMb: 1024,
        expectedVersion: 0
      })
      .expect(200);
    expect(saved.body).toEqual(expect.objectContaining({
      version: 1,
      persisted: true,
      maxCacheMb: 1024,
      cellularKinds: ['IMAGE', 'AUDIO']
    }));

    const stale = await request(app.getHttpServer())
      .put('/media/download-preferences')
      .set(authorization)
      .send({
        wifiKinds: ['IMAGE'], cellularKinds: [], roamingKinds: [],
        backgroundDownloads: false, respectDataSaver: true,
        maxCacheMb: 128, expectedVersion: 0
      })
      .expect(409);
    expect(stale.body).toEqual(expect.objectContaining({
      code: 'MEDIA_DOWNLOAD_VERSION_CONFLICT',
      details: expect.objectContaining({ currentVersion: 1 })
    }));

    await request(app.getHttpServer())
      .put('/media/download-preferences')
      .set(authorization)
      .send({
        wifiKinds: ['IMAGE', 'IMAGE'], cellularKinds: [], roamingKinds: [],
        backgroundDownloads: false, respectDataSaver: true,
        maxCacheMb: 32, expectedVersion: 1
      })
      .expect(400);

    const exported = await accounts.exportData(userId);
    expect(exported.formatVersion).toBe(11);
    expect(exported.mediaDownloadPolicy).toEqual(expect.objectContaining({
      formatVersion: 1,
      localCacheInventoryIncluded: false,
      signedUrlsIncluded: false,
      preference: expect.objectContaining({ userId, version: 1, maxCacheMb: 1024 })
    }));
    expect(JSON.stringify(exported.mediaDownloadPolicy)).not.toContain('token');
    expect(await prisma.auditLog.count({
      where: { actorId: userId, action: 'MEDIA_DOWNLOAD_PREFERENCE_UPDATED' }
    })).toBe(1);

    await accounts.deleteAccount(userId, { password: 'KnowMeTest123!' });
    expect(await prisma.userMediaDownloadPreference.count({ where: { userId } })).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe private media pipeline (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.mediaDownloadGrant.deleteMany();
    await prisma.mediaAccessGrant.deleteMany();
    await prisma.mediaAsset.deleteMany();
    await prisma.mediaUploadSession.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `media-${index}@knowme.test`,
        username: `media_${index}`,
        displayName: `Media ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  async function session(token: string, maxBytes = 200000) {
    return request(app.getHttpServer())
      .post('/media/uploads')
      .set('Authorization', `Bearer ${token}`)
      .send({
        purpose: 'POST',
        visibility: 'PRIVATE',
        maxBytes,
        allowedMime: ['image/png']
      })
      .expect(201);
  }

  it('validates bytes, consumes upload sessions and isolates private assets', async () => {
    const owner = await register('owner');
    const guest = await register('guest');
    const ownerToken = owner.body.accessToken as string;
    const guestToken = guest.body.accessToken as string;
    const guestId = guest.body.user.id as string;

    const spoofSession = await session(ownerToken);
    await request(app.getHttpServer())
      .post(`/media/uploads/${spoofSession.body.id}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-upload-token', spoofSession.body.uploadToken)
      .attach('file', Buffer.from('not a png'), {
        filename: 'fake.png',
        contentType: 'image/png'
      })
      .expect(400);

    const validSession = await session(ownerToken);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('knowme-private-image')
    ]);
    const upload = await request(app.getHttpServer())
      .post(`/media/uploads/${validSession.body.id}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-upload-token', validSession.body.uploadToken)
      .attach('file', png, { filename: '../avatar.png', contentType: 'image/png' })
      .expect(201);

    expect(upload.body.status).toBe('AVAILABLE');
    expect(upload.body.storageKey).toBeUndefined();
    expect(upload.body.originalName).toBe('avatar.png');
    const assetId = upload.body.id as string;

    await request(app.getHttpServer())
      .post(`/media/uploads/${validSession.body.id}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-upload-token', validSession.body.uploadToken)
      .attach('file', png, { filename: 'replay.png', contentType: 'image/png' })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/media/${assetId}/download-grant`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(403);

    const ownerGrant = await request(app.getHttpServer())
      .post(`/media/${assetId}/download-grant`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/media/${assetId}/content?token=${encodeURIComponent(ownerGrant.body.token)}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect('Content-Type', /image\/png/)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/media/${assetId}/grants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ granteeId: guestId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/media/${assetId}/download-grant`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(201);

    const infectedSession = await session(ownerToken);
    const infected = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')
    ]);
    const quarantined = await request(app.getHttpServer())
      .post(`/media/uploads/${infectedSession.body.id}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-upload-token', infectedSession.body.uploadToken)
      .attach('file', infected, { filename: 'infected.png', contentType: 'image/png' })
      .expect(201);

    expect(quarantined.body.status).toBe('QUARANTINED');
    expect(quarantined.body.scannerVerdict).toBe('INFECTED');
    await request(app.getHttpServer())
      .post(`/media/${quarantined.body.id}/download-grant`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);
  });
});

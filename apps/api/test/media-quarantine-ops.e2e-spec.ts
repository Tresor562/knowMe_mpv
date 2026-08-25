import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Media quarantine operations status (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "MediaAsset" CASCADE');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@media-ops.knowme.test`,
        username: `media_ops_${index}`,
        displayName: `Media Ops ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('keeps quarantine telemetry private and rescan separately permission-gated', async () => {
    await request(app.getHttpServer()).get('/admin/operations/media-quarantine').expect(401);
    await request(app.getHttpServer()).get('/admin/operations/media-quarantine-retention').expect(401);
    await request(app.getHttpServer())
      .post('/admin/operations/media-quarantine/unknown/rescan')
      .expect(401);

    const operator = await register('operator');
    const token = operator.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/admin/operations/media-quarantine')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/admin/operations/media-quarantine-retention')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/admin/operations/media-quarantine/unknown/rescan')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await prisma.user.update({
      where: { id: operator.body.user.id },
      data: { role: 'ADMIN' }
    });

    const retention = await request(app.getHttpServer())
      .get('/admin/operations/media-quarantine-retention')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(retention.body).toEqual({
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
      lastResult: null,
      backlog: {
        expiredQuarantined: 0,
        retryDue: 0,
        retryScheduled: 0,
        maxBackoffRetries: 0,
        nextScheduledRetryAt: null
      }
    });

    const oldestQuarantinedAt = new Date('2026-08-01T00:00:00.000Z');
    await prisma.mediaAsset.createMany({
      data: [
        {
          ownerId: operator.body.user.id,
          storageKey: 'ops/quarantine/infected',
          originalName: 'infected.png',
          declaredMime: 'image/png',
          detectedMime: 'image/png',
          size: 128,
          sha256: 'a'.repeat(64),
          purpose: 'POST',
          status: 'QUARANTINED',
          scannerVerdict: 'INFECTED',
          createdAt: oldestQuarantinedAt
        },
        {
          ownerId: operator.body.user.id,
          storageKey: 'ops/quarantine/unavailable',
          originalName: 'unavailable.png',
          declaredMime: 'image/png',
          detectedMime: 'image/png',
          size: 256,
          sha256: 'b'.repeat(64),
          purpose: 'POST',
          status: 'QUARANTINED',
          scannerVerdict: 'UNAVAILABLE',
          createdAt: new Date('2026-08-02T00:00:00.000Z')
        },
        {
          ownerId: operator.body.user.id,
          storageKey: 'ops/quarantine/other',
          originalName: 'other.png',
          declaredMime: 'image/png',
          detectedMime: 'image/png',
          size: 512,
          sha256: 'c'.repeat(64),
          purpose: 'POST',
          status: 'QUARANTINED',
          scannerVerdict: 'PENDING',
          createdAt: new Date('2026-08-03T00:00:00.000Z')
        },
        {
          ownerId: operator.body.user.id,
          storageKey: 'ops/available',
          originalName: 'available.png',
          declaredMime: 'image/png',
          detectedMime: 'image/png',
          size: 1024,
          sha256: 'd'.repeat(64),
          purpose: 'POST',
          status: 'AVAILABLE',
          scannerVerdict: 'CLEAN'
        },
        {
          ownerId: operator.body.user.id,
          storageKey: 'ops/quarantine/deleted',
          originalName: 'deleted.png',
          declaredMime: 'image/png',
          detectedMime: 'image/png',
          size: 2048,
          sha256: 'e'.repeat(64),
          purpose: 'POST',
          status: 'QUARANTINED',
          scannerVerdict: 'INFECTED',
          deletedAt: new Date('2026-08-04T00:00:00.000Z')
        }
      ]
    });

    const response = await request(app.getHttpServer())
      .get('/admin/operations/media-quarantine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      readiness: 'BLOCKED_INFECTED',
      quarantined: 3,
      infected: 1,
      unavailable: 1,
      oldestQuarantinedAt: oldestQuarantinedAt.toISOString()
    });
    expect(Object.keys(response.body).sort()).toEqual([
      'infected',
      'oldestQuarantinedAt',
      'quarantined',
      'readiness',
      'unavailable'
    ]);

    const infected = await prisma.mediaAsset.findUnique({
      where: { storageKey: 'ops/quarantine/infected' },
      select: { id: true }
    });
    expect(infected).not.toBeNull();
    await request(app.getHttpServer())
      .post(`/admin/operations/media-quarantine/${infected!.id}/rescan`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Media purge alert operations status (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps alert delivery telemetry permission-gated and privacy-bounded', async () => {
    await request(app.getHttpServer())
      .get('/admin/operations/media-quarantine-alert')
      .expect(401);

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'alert-ops@knowme.test',
        username: 'alert_ops',
        displayName: 'Alert Ops',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const token = registered.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/admin/operations/media-quarantine-alert')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await prisma.user.update({
      where: { id: registered.body.user.id },
      data: { role: 'ADMIN' }
    });

    const response = await request(app.getHttpServer())
      .get('/admin/operations/media-quarantine-alert')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      running: expect.any(Boolean),
      pollIntervalMs: 300000,
      reminderIntervalMs: 3600000,
      lastObservedReadiness: expect.toBeOneOf
        ? expect.toBeOneOf([null, 'DISABLED', 'CLEAR', 'ACTION_REQUIRED', 'BLOCKED_WORKER', 'BLOCKED_MAX_BACKOFF'])
        : response.body.lastObservedReadiness,
      lastPollAt: response.body.lastPollAt,
      lastAlertAttemptAt: response.body.lastAlertAttemptAt,
      lastDeliveredAt: response.body.lastDeliveredAt,
      lastFailureAt: response.body.lastFailureAt,
      lastResult: response.body.lastResult
    });
    expect(Object.keys(response.body).sort()).toEqual([
      'lastAlertAttemptAt',
      'lastDeliveredAt',
      'lastFailureAt',
      'lastObservedReadiness',
      'lastPollAt',
      'lastResult',
      'pollIntervalMs',
      'reminderIntervalMs',
      'running'
    ]);

    for (const key of ['lastPollAt', 'lastAlertAttemptAt', 'lastDeliveredAt', 'lastFailureAt']) {
      expect(response.body[key] === null || typeof response.body[key] === 'string').toBe(true);
    }
    expect(
      response.body.lastObservedReadiness === null || typeof response.body.lastObservedReadiness === 'string'
    ).toBe(true);
    expect(response.body.lastResult === null || typeof response.body.lastResult === 'string').toBe(true);
  });
});

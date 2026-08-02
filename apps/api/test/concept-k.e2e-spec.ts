import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe Concept K foundation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let account: AccountService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    account = app.get(AccountService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('shares an accessible catalog and records only bounded performance telemetry', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'concept-k@knowme.test',
        username: 'concept_k_user',
        displayName: 'Concept K User',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const token = registration.body.accessToken as string;
    const userId = registration.body.user.id as string;

    const catalog = await request(app.getHttpServer())
      .get('/concept-k/catalog')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(catalog.body.version).toBe(1);
    expect(catalog.body.events).toHaveLength(10);
    expect(catalog.body.rules).toEqual(
      expect.objectContaining({
        loadStrategy: 'LAZY',
        blocking: false,
        skippable: true,
        staticFallbackRequired: true,
        contentCaptured: false
      })
    );

    const defaultPreference = await request(app.getHttpServer())
      .get('/concept-k/preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(defaultPreference.body).toEqual(
      expect.objectContaining({
        mode: 'AUTO',
        soundEnabled: false,
        hapticsEnabled: true
      })
    );

    await request(app.getHttpServer())
      .patch('/concept-k/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'OFF', soundEnabled: true, hapticsEnabled: true })
      .expect(200);

    const disabled = await request(app.getHttpServer())
      .post('/concept-k/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventKey: 'LEVEL_UP',
        clientReducedMotion: false,
        deviceClass: 'HIGH'
      })
      .expect(201);
    expect(disabled.body.plan).toEqual(
      expect.objectContaining({
        variant: 'STATIC',
        shouldAnimate: false,
        reason: 'USER_DISABLED',
        blocking: false,
        skippable: true
      })
    );

    await request(app.getHttpServer())
      .patch('/concept-k/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'AUTO', soundEnabled: true, hapticsEnabled: true })
      .expect(200);

    const reduced = await request(app.getHttpServer())
      .post('/concept-k/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventKey: 'CHALLENGE_COMPLETED',
        clientReducedMotion: true,
        deviceClass: 'HIGH'
      })
      .expect(201);
    expect(reduced.body.plan.variant).toBe('REDUCED');
    expect(reduced.body.plan.reason).toBe('SYSTEM_REDUCED_MOTION');
    expect(reduced.body.plan.soundEnabled).toBe(false);

    await request(app.getHttpServer())
      .post('/concept-k/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventKey: 'UNKNOWN_EVENT',
        clientReducedMotion: false,
        deviceClass: 'UNKNOWN'
      })
      .expect(404);

    const telemetryPayload = {
      eventKey: 'CHALLENGE_COMPLETED',
      clientEventId: 'web:concept-k:e2e-001',
      outcome: 'PLAYED',
      durationMs: 420,
      assetBytes: 125000,
      platform: 'WEB',
      clientReducedMotion: false,
      deviceClass: 'MID'
    };
    const firstTelemetry = await request(app.getHttpServer())
      .post('/concept-k/telemetry')
      .set('Authorization', `Bearer ${token}`)
      .send(telemetryPayload)
      .expect(201);
    expect(firstTelemetry.body.replayed).toBe(false);
    expect(firstTelemetry.body.event).toEqual(
      expect.objectContaining({
        userId,
        eventKey: 'CHALLENGE_COMPLETED',
        catalogVersion: 1,
        preferenceMode: 'AUTO',
        variant: 'FULL',
        platform: 'WEB',
        deviceClass: 'MID'
      })
    );

    const replay = await request(app.getHttpServer())
      .post('/concept-k/telemetry')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...telemetryPayload, durationMs: 9999 })
      .expect(201);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.event.id).toBe(firstTelemetry.body.event.id);
    expect(
      await prisma.animationTelemetryEvent.count({
        where: { idempotencyKey: `concept-k:${userId}:web:concept-k:e2e-001` }
      })
    ).toBe(1);

    const exported = await account.exportData(userId);
    expect(exported.conceptK).toEqual(
      expect.objectContaining({
        catalogVersion: 1,
        preference: expect.objectContaining({ mode: 'AUTO' }),
        telemetry: expect.arrayContaining([
          expect.objectContaining({ eventKey: 'CHALLENGE_COMPLETED' })
        ])
      })
    );
    expect(
      await prisma.auditLog.count({
        where: { action: 'ANIMATION_PREFERENCE_UPDATED', actorId: userId }
      })
    ).toBe(2);

    await account.deleteAccount(userId, { password: 'KnowMeTest123!' });
    expect(await prisma.userAnimationPreference.count({ where: { userId } })).toBe(0);
    expect(await prisma.animationTelemetryEvent.count({ where: { userId } })).toBe(0);
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe privacy, consent and retention (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.dataRetentionExecution.deleteMany();
    await prisma.dataRetentionPolicy.deleteMany();
    await prisma.dataSubjectRequest.deleteMany();
    await prisma.privacyConsentEvent.deleteMany();
    await prisma.privacyPreference.deleteMany();
    await prisma.privacyPolicyVersion.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');

    await prisma.privacyPolicyVersion.createMany({
      data: [
        {
          key: 'terms',
          version: 1,
          locale: 'fr',
          title: 'Conditions KnowMe',
          summary: 'Conditions nécessaires au fonctionnement de KnowMe.',
          contentHash: 'a'.repeat(64),
          required: true,
          effectiveAt: new Date(Date.now() - 60_000)
        },
        {
          key: 'analytics',
          version: 1,
          locale: 'fr',
          title: 'Mesure d’audience',
          summary: 'Mesure facultative pour améliorer l’expérience.',
          contentHash: 'b'.repeat(64),
          required: false,
          effectiveAt: new Date(Date.now() - 60_000)
        }
      ]
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps consent immutable, idempotent and server-authoritative', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'privacy@knowme.test',
        username: 'privacy_member',
        displayName: 'Privacy Member',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const token = registration.body.accessToken as string;
    const userId = registration.body.user.id as string;

    const policies = await request(app.getHttpServer())
      .get('/privacy/policies?locale=fr')
      .expect(200);
    expect(policies.body).toHaveLength(2);

    const grantPayload = {
      policyKey: 'analytics',
      policyVersion: 1,
      locale: 'fr',
      action: 'GRANT',
      source: 'WEB',
      idempotencyKey: 'privacy-grant-analytics-0001'
    };

    const firstGrant = await request(app.getHttpServer())
      .post('/privacy/consents')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'KnowMe Privacy Test')
      .send(grantPayload)
      .expect(201);

    const replay = await request(app.getHttpServer())
      .post('/privacy/consents')
      .set('Authorization', `Bearer ${token}`)
      .send(grantPayload)
      .expect(201);

    expect(replay.body.id).toBe(firstGrant.body.id);
    expect(await prisma.privacyConsentEvent.count({ where: { userId } })).toBe(1);
    expect(firstGrant.body.evidenceHash).toBeUndefined();
    expect(firstGrant.body.ipHash).toBeUndefined();

    await request(app.getHttpServer())
      .post('/privacy/consents')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...grantPayload, action: 'WITHDRAW' })
      .expect(409);

    await request(app.getHttpServer())
      .post('/privacy/consents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        policyKey: 'terms',
        policyVersion: 1,
        locale: 'fr',
        action: 'WITHDRAW',
        source: 'WEB',
        idempotencyKey: 'privacy-withdraw-required-0001'
      })
      .expect(409);

    const preferences = await request(app.getHttpServer())
      .patch('/privacy/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        profileVisibility: 'PRIVATE',
        discoverability: false,
        analytics: false,
        marketing: false
      })
      .expect(200);
    expect(preferences.body.profileVisibility).toBe('PRIVATE');
    expect(preferences.body.discoverability).toBe(false);

    const dataRequestPayload = {
      type: 'EXPORT',
      idempotencyKey: 'privacy-export-request-0001',
      reason: 'Copie de mes données'
    };
    const dataRequest = await request(app.getHttpServer())
      .post('/privacy/requests')
      .set('Authorization', `Bearer ${token}`)
      .send(dataRequestPayload)
      .expect(201);
    const dataRequestReplay = await request(app.getHttpServer())
      .post('/privacy/requests')
      .set('Authorization', `Bearer ${token}`)
      .send(dataRequestPayload)
      .expect(201);
    expect(dataRequestReplay.body.id).toBe(dataRequest.body.id);

    const center = await request(app.getHttpServer())
      .get('/privacy/center')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(center.body.preferences.profileVisibility).toBe('PRIVATE');
    expect(center.body.consentHistory[0].evidenceHash).toBeUndefined();
    expect(center.body.requests).toHaveLength(1);

    const exported = await request(app.getHttpServer())
      .get('/account/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(exported.body.formatVersion).toBe(6);
    expect(exported.body.media).toEqual([]);
    expect(exported.body.challengeHistory).toEqual([]);
    expect(exported.body.challengeReferences).toEqual([]);
    expect(exported.body.progression).toEqual({ profile: null, ledger: [] });
    expect(exported.body.privacy.preferences.profileVisibility).toBe('PRIVATE');
    expect(exported.body.privacy.consentEvents[0].evidenceHash).toBeUndefined();

    await request(app.getHttpServer())
      .delete('/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'KnowMeTest123!' })
      .expect(200);

    expect(await prisma.privacyConsentEvent.count({ where: { userId } })).toBe(0);
    expect(await prisma.privacyPreference.count({ where: { userId } })).toBe(0);
    expect(await prisma.dataSubjectRequest.count({ where: { userId } })).toBe(0);
    expect(await prisma.xpLedgerEntry.count({ where: { userId } })).toBe(0);
    expect(await prisma.userProgression.count({ where: { userId } })).toBe(0);
  });
});

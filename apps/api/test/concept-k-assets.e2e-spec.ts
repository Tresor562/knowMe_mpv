import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe Concept K asset catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(name: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${name}@concept-k-assets.knowme.test`,
        username: `concept_assets_${name}`,
        displayName: `Concept Assets ${name}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('publishes only original characters and resolves integrity checked rollouts', async () => {
    const admin = await register('admin');
    const member = await register('member');
    const adminToken = admin.body.accessToken as string;
    const memberToken = member.body.accessToken as string;
    const adminId = admin.body.user.id as string;

    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN' }
    });

    await request(app.getHttpServer())
      .post('/admin/concept-k/characters')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        key: 'kora',
        version: 1,
        displayName: 'Kora',
        description: 'Personnage original KnowMe qui célèbre les progrès avec calme.',
        active: true,
        reason: 'Création initiale du catalogue Concept K.'
      })
      .expect(403);

    const character = await request(app.getHttpServer())
      .post('/admin/concept-k/characters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'kora',
        version: 1,
        displayName: 'Kora',
        description: 'Personnage original KnowMe qui célèbre les progrès avec calme.',
        active: true,
        reason: 'Création initiale du catalogue Concept K.'
      })
      .expect(201);
    expect(character.body).toEqual(
      expect.objectContaining({
        key: 'kora',
        version: 1,
        originalWork: true,
        licenseKey: 'KNOWME_ORIGINAL',
        active: true
      })
    );

    await request(app.getHttpServer())
      .post('/admin/concept-k/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'kora-level-up-full',
        version: 1,
        eventKey: 'LEVEL_UP',
        characterId: character.body.id,
        variant: 'FULL',
        platform: 'WEB',
        deviceClass: 'MID',
        publicUrl: '/assets/concept-k/kora-level-up-v1.json',
        sha256: 'a'.repeat(64),
        bytes: 120000,
        mimeType: 'application/json',
        durationMs: 4900,
        active: true,
        rolloutPercentage: 100,
        reason: 'Durée volontairement hors budget.'
      })
      .expect(400);

    const asset = await request(app.getHttpServer())
      .post('/admin/concept-k/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'kora-level-up-full',
        version: 1,
        eventKey: 'LEVEL_UP',
        characterId: character.body.id,
        variant: 'FULL',
        platform: 'WEB',
        deviceClass: 'MID',
        publicUrl: '/assets/concept-k/kora-level-up-v1.json',
        sha256: 'b'.repeat(64),
        bytes: 120000,
        mimeType: 'application/json',
        durationMs: 1500,
        active: true,
        rolloutPercentage: 100,
        reason: 'Publication contrôlée du premier asset original.'
      })
      .expect(201);
    expect(asset.body).toEqual(
      expect.objectContaining({
        eventKey: 'LEVEL_UP',
        variant: 'FULL',
        sha256: 'b'.repeat(64),
        rolloutPercentage: 100
      })
    );

    const publicCharacters = await request(app.getHttpServer())
      .get('/concept-k/characters')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(publicCharacters.body).toEqual(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            key: 'kora',
            originalWork: true,
            licenseKey: 'KNOWME_ORIGINAL'
          })
        ]),
        rules: expect.objectContaining({
          integrityHashRequired: true,
          lazyDelivery: true,
          paidPriorityAllowed: false
        })
      })
    );

    const firstResolution = await request(app.getHttpServer())
      .post('/concept-k/assets/resolve')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        eventKey: 'LEVEL_UP',
        clientReducedMotion: false,
        deviceClass: 'MID',
        platform: 'WEB'
      })
      .expect(201);
    expect(firstResolution.body).toEqual(
      expect.objectContaining({
        deliveryVariant: 'FULL',
        fallback: null,
        asset: expect.objectContaining({
          key: 'kora-level-up-full',
          version: 1,
          sha256: 'b'.repeat(64),
          integrityAlgorithm: 'SHA-256',
          character: expect.objectContaining({
            displayName: 'Kora',
            originalWork: true,
            licenseKey: 'KNOWME_ORIGINAL'
          })
        }),
        rules: expect.objectContaining({
          integrityRequired: true,
          clientCanOverrideRollout: false,
          paidPriorityAllowed: false
        })
      })
    );

    const replayResolution = await request(app.getHttpServer())
      .post('/concept-k/assets/resolve')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        eventKey: 'LEVEL_UP',
        clientReducedMotion: false,
        deviceClass: 'MID',
        platform: 'WEB'
      })
      .expect(201);
    expect(replayResolution.body.asset.id).toBe(firstResolution.body.asset.id);

    await request(app.getHttpServer())
      .patch(`/admin/concept-k/assets/${asset.body.id}/rollout`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        active: true,
        rolloutPercentage: 0,
        reason: 'Arrêt immédiat du rollout pour validation du fallback.'
      })
      .expect(200);

    const rolloutFallback = await request(app.getHttpServer())
      .post('/concept-k/assets/resolve')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        eventKey: 'LEVEL_UP',
        clientReducedMotion: false,
        deviceClass: 'MID',
        platform: 'WEB'
      })
      .expect(201);
    expect(rolloutFallback.body).toEqual(
      expect.objectContaining({
        deliveryVariant: 'STATIC',
        asset: null,
        fallback: expect.objectContaining({ reason: 'NO_ELIGIBLE_ASSET' })
      })
    );

    await request(app.getHttpServer())
      .patch('/concept-k/preferences')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ mode: 'OFF', soundEnabled: false, hapticsEnabled: false })
      .expect(200);

    const disabledFallback = await request(app.getHttpServer())
      .post('/concept-k/assets/resolve')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        eventKey: 'LEVEL_UP',
        clientReducedMotion: false,
        deviceClass: 'MID',
        platform: 'WEB'
      })
      .expect(201);
    expect(disabledFallback.body.fallback.reason).toBe('STATIC_PLAN');

    expect(
      await prisma.auditLog.count({
        where: {
          actorId: adminId,
          action: {
            in: [
              'CONCEPT_K_CHARACTER_CREATED',
              'CONCEPT_K_ASSET_CREATED',
              'CONCEPT_K_ASSET_ROLLOUT_UPDATED'
            ]
          }
        }
      })
    ).toBe(3);
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe Concept K delivery health (e2e)', () => {
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
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "ConceptKAssetManifest", "ConceptKCharacterDefinition", "User" RESTART IDENTITY CASCADE'
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "ConceptKAssetManifest", "ConceptKCharacterDefinition", "User" RESTART IDENTITY CASCADE'
    );
    await app.close();
  });

  async function register(name: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${name}@concept-k-health.knowme.test`,
        username: `concept_health_${name}`,
        displayName: `Concept Health ${name}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('quarantines an unhealthy asset after distinct account samples and restores it with audit', async () => {
    const admin = await register('admin');
    const members = [];
    for (let index = 0; index < 4; index += 1) {
      members.push(await register(`member_${index + 1}`));
    }
    const adminToken = admin.body.accessToken as string;
    const adminId = admin.body.user.id as string;
    await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });

    const character = await request(app.getHttpServer())
      .post('/admin/concept-k/characters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'nilo',
        version: 1,
        displayName: 'Nilo',
        description: 'Personnage original KnowMe conçu pour les célébrations sobres.',
        active: true,
        reason: 'Personnage du test de santé des livraisons.'
      })
      .expect(201);

    const expectedHash = 'd'.repeat(64);
    const asset = await request(app.getHttpServer())
      .post('/admin/concept-k/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'nilo-level-up-health',
        version: 1,
        eventKey: 'LEVEL_UP',
        characterId: character.body.id,
        variant: 'FULL',
        platform: 'ALL',
        deviceClass: 'ALL',
        publicUrl: '/assets/concept-k/nilo-level-up-health-v1.json',
        sha256: expectedHash,
        bytes: 110000,
        mimeType: 'application/json',
        durationMs: 1400,
        active: true,
        rolloutPercentage: 100,
        reason: 'Asset contrôlé pour les tests de santé.'
      })
      .expect(201);

    const receipts: Array<{ token: string; userId: string }> = [
      ...members.map((member) => ({
        token: member.body.accessToken as string,
        userId: member.body.user.id as string
      })),
      { token: adminToken, userId: adminId }
    ];

    for (let index = 0; index < 4; index += 1) {
      const result = await request(app.getHttpServer())
        .post('/concept-k/assets/delivery')
        .set('Authorization', `Bearer ${receipts[index].token}`)
        .send({
          assetId: asset.body.id,
          clientEventId: `health:failure:${index + 1}`,
          outcome: 'INTEGRITY_FAILED',
          durationMs: 90,
          platform: 'WEB',
          deviceClass: 'MID',
          observedSha256: 'e'.repeat(64)
        })
        .expect(201);
      expect(result.body.quarantinedNow).toBe(false);
    }

    const replay = await request(app.getHttpServer())
      .post('/concept-k/assets/delivery')
      .set('Authorization', `Bearer ${receipts[0].token}`)
      .send({
        assetId: asset.body.id,
        clientEventId: 'health:failure:replay',
        outcome: 'LOAD_FAILED',
        durationMs: 500,
        platform: 'WEB',
        deviceClass: 'MID'
      })
      .expect(201);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.health.totalSamples).toBe(4);

    const fifth = await request(app.getHttpServer())
      .post('/concept-k/assets/delivery')
      .set('Authorization', `Bearer ${receipts[4].token}`)
      .send({
        assetId: asset.body.id,
        clientEventId: 'health:success:5',
        outcome: 'PLAYED',
        durationMs: 750,
        platform: 'WEB',
        deviceClass: 'MID'
      })
      .expect(201);
    expect(fifth.body).toEqual(
      expect.objectContaining({
        replayed: false,
        quarantinedNow: true,
        health: expect.objectContaining({
          totalSamples: 5,
          failureSamples: 4,
          failureRate: 0.8
        })
      })
    );

    expect(
      await prisma.conceptKAssetDeliveryEvent.count({
        where: { assetId: asset.body.id }
      })
    ).toBe(5);
    const quarantined = await prisma.conceptKAssetManifest.findUnique({
      where: { id: asset.body.id }
    });
    expect(quarantined).toEqual(
      expect.objectContaining({
        active: false,
        quarantineSource: 'AUTOMATIC_HEALTH_GATE'
      })
    );
    expect(quarantined?.quarantinedAt).not.toBeNull();

    const fallback = await request(app.getHttpServer())
      .post('/concept-k/assets/resolve')
      .set('Authorization', `Bearer ${receipts[4].token}`)
      .send({
        eventKey: 'LEVEL_UP',
        clientReducedMotion: false,
        deviceClass: 'MID',
        platform: 'WEB'
      })
      .expect(201);
    expect(fallback.body).toEqual(
      expect.objectContaining({
        deliveryVariant: 'STATIC',
        asset: null,
        fallback: expect.objectContaining({ reason: 'NO_ELIGIBLE_ASSET' })
      })
    );

    const health = await request(app.getHttpServer())
      .get('/admin/concept-k/assets/health')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(health.body).toEqual(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            asset: expect.objectContaining({
              id: asset.body.id,
              active: false,
              quarantineSource: 'AUTOMATIC_HEALTH_GATE'
            }),
            health: expect.objectContaining({
              totalSamples: 5,
              failureSamples: 4
            })
          })
        ]),
        policy: expect.objectContaining({
          minimumSamples: 5,
          minimumFailures: 4,
          failureRateThreshold: 0.8,
          oneSamplePerAccountAssetDay: true,
          premiumBypassAllowed: false
        })
      })
    );

    const restored = await request(app.getHttpServer())
      .patch(`/admin/concept-k/assets/${asset.body.id}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Manifest vérifié et asset republié après correction.' })
      .expect(200);
    expect(restored.body).toEqual(
      expect.objectContaining({
        replayed: false,
        asset: expect.objectContaining({
          active: true,
          quarantinedAt: null,
          quarantineReason: null,
          quarantineSource: null,
          restoredById: adminId
        })
      })
    );

    const resolvedAgain = await request(app.getHttpServer())
      .post('/concept-k/assets/resolve')
      .set('Authorization', `Bearer ${receipts[4].token}`)
      .send({
        eventKey: 'LEVEL_UP',
        clientReducedMotion: false,
        deviceClass: 'MID',
        platform: 'WEB'
      })
      .expect(201);
    expect(resolvedAgain.body.asset.id).toBe(asset.body.id);

    expect(
      await prisma.auditLog.count({
        where: {
          entityId: asset.body.id,
          action: {
            in: [
              'CONCEPT_K_ASSET_AUTO_QUARANTINED',
              'CONCEPT_K_ASSET_RESTORED'
            ]
          }
        }
      })
    ).toBe(2);

    const exported = await account.exportData(receipts[0].userId);
    expect(exported.conceptK.assetDeliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetId: asset.body.id, outcome: 'INTEGRITY_FAILED' })
      ])
    );

    await account.deleteAccount(receipts[0].userId, { password: 'KnowMeTest123!' });
    expect(
      await prisma.conceptKAssetDeliveryEvent.count({
        where: { userId: receipts[0].userId }
      })
    ).toBe(0);
  });
});
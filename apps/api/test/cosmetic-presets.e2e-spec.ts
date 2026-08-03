import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe cosmetic presets (e2e)', () => {
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

    await prisma.cosmeticPresetActivation.deleteMany();
    await prisma.cosmeticPresetState.deleteMany();
    await prisma.cosmeticPresetItem.deleteMany();
    await prisma.cosmeticPreset.deleteMany();
    await prisma.cosmeticEquipment.deleteMany();
    await prisma.cosmeticPurchaseReceipt.deleteMany();
    await prisma.cosmeticOwnership.deleteMany();
    await prisma.cosmeticOfferDefinition.deleteMany();
    await prisma.cosmeticItemDefinition.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(name: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${name}@preset.knowme.test`,
        username: `preset_${name}`,
        displayName: `Preset ${name}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('creates, previews and atomically activates an idempotent privacy-safe preset', async () => {
    const admin = await register('admin');
    const user = await register('owner');
    const adminToken = admin.body.accessToken as string;
    const userToken = user.body.accessToken as string;
    const adminId = admin.body.user.id as string;
    const userId = user.body.user.id as string;

    await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });

    const frame = await request(app.getHttpServer())
      .post('/admin/cosmetics/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'preset-aurora-frame',
        version: 1,
        name: 'Cadre Aurore preset',
        description: 'Cadre visuel de validation.',
        slot: 'AVATAR_FRAME',
        rarity: 'RARE',
        assetUrl: '/assets/cosmetics/preset-aurora-frame-v1.json',
        previewUrl: '/assets/cosmetics/preset-aurora-frame-v1.webp',
        active: true,
        reason: 'Validation KMD-030 des presets synchronisés.'
      })
      .expect(201);

    const background = await request(app.getHttpServer())
      .post('/admin/cosmetics/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'preset-nebula-background',
        version: 1,
        name: 'Fond Nébuleuse preset',
        description: 'Fond visuel de validation.',
        slot: 'PROFILE_BACKGROUND',
        rarity: 'EPIC',
        assetUrl: '/assets/cosmetics/preset-nebula-background-v1.json',
        previewUrl: '/assets/cosmetics/preset-nebula-background-v1.webp',
        active: true,
        reason: 'Validation KMD-030 du thème de profil.'
      })
      .expect(201);

    const ownerships: Record<string, string> = {};
    for (const item of [frame.body, background.body]) {
      const grant = await request(app.getHttpServer())
        .post('/admin/cosmetics/grants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId,
          itemId: item.id,
          source: 'EVENT',
          reason: 'Attribution pour le scénario E2E KMD-030.'
        })
        .expect(201);
      ownerships[item.id] = grant.body.ownership.id;
    }

    const created = await request(app.getHttpServer())
      .post('/cosmetics/presets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: '  Nuit   Nébuleuse  ',
        setAsDefault: true,
        items: [
          { slot: 'AVATAR_FRAME', itemId: frame.body.id },
          { slot: 'PROFILE_BACKGROUND', itemId: background.body.id }
        ]
      })
      .expect(201);

    const presetId = created.body.preset.id as string;
    expect(created.body.preset).toEqual(
      expect.objectContaining({
        name: 'Nuit Nébuleuse',
        isDefault: true,
        items: expect.arrayContaining([
          expect.objectContaining({ slot: 'AVATAR_FRAME', itemId: frame.body.id }),
          expect.objectContaining({
            slot: 'PROFILE_BACKGROUND',
            itemId: background.body.id
          })
        ])
      })
    );

    const preview = await request(app.getHttpServer())
      .get(`/cosmetics/presets/${presetId}/preview`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(preview.body.preview).toHaveLength(2);
    expect(preview.body.preview.every((entry: { applicable: boolean }) => entry.applicable)).toBe(
      true
    );

    await request(app.getHttpServer())
      .patch('/privacy/preferences')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ hiddenCosmeticSlots: ['AVATAR_FRAME'] })
      .expect(200);

    const hiddenPreview = await request(app.getHttpServer())
      .get(`/cosmetics/presets/${presetId}/preview`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(hiddenPreview.body.preview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slot: 'AVATAR_FRAME',
          applicable: false,
          blockedReason: 'HIDDEN_SLOT'
        })
      ])
    );

    const idempotencyKey = 'preset-activation-owner-0001';
    const activated = await request(app.getHttpServer())
      .post(`/cosmetics/presets/${presetId}/activate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ idempotencyKey })
      .expect(201);
    expect(activated.body).toEqual(
      expect.objectContaining({
        replayed: false,
        state: expect.objectContaining({ activePresetId: presetId, activationVersion: 1 }),
        maintenance: expect.objectContaining({ skippedHiddenSlots: ['AVATAR_FRAME'] })
      })
    );
    expect(activated.body.equipment).toEqual([
      expect.objectContaining({
        slot: 'PROFILE_BACKGROUND',
        itemId: background.body.id
      })
    ]);

    const replay = await request(app.getHttpServer())
      .post(`/cosmetics/presets/${presetId}/activate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ idempotencyKey })
      .expect(201);
    expect(replay.body.replayed).toBe(true);
    expect(await prisma.cosmeticPresetActivation.count({ where: { userId } })).toBe(1);

    const manualUnequip = await request(app.getHttpServer())
      .put('/cosmetics/equipment/PROFILE_BACKGROUND')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ itemId: null })
      .expect(200);
    expect(manualUnequip.body.activePresetCleared).toBe(true);

    const afterManualChange = await request(app.getHttpServer())
      .get('/cosmetics/presets')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(afterManualChange.body.state.activePresetId).toBeNull();
    expect(afterManualChange.body.state.defaultPresetId).toBe(presetId);

    const secondIdempotencyKey = 'preset-activation-owner-0002';
    const reactivated = await request(app.getHttpServer())
      .post(`/cosmetics/presets/${presetId}/activate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ idempotencyKey: secondIdempotencyKey })
      .expect(201);
    expect(reactivated.body).toEqual(
      expect.objectContaining({
        replayed: false,
        state: expect.objectContaining({ activePresetId: presetId, activationVersion: 2 })
      })
    );
    expect(await prisma.cosmeticPresetActivation.count({ where: { userId } })).toBe(2);

    const revoked = await request(app.getHttpServer())
      .patch(`/admin/cosmetics/grants/${ownerships[background.body.id]}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Validation du nettoyage automatique du preset.' })
      .expect(200);
    expect(revoked.body.activePresetCleared).toBe(true);

    const listed = await request(app.getHttpServer())
      .get('/cosmetics/presets')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(listed.body.maintenance.removedInvalidItems).toBe(1);
    expect(listed.body.presets[0].items).toHaveLength(1);
    expect(listed.body.state.activePresetId).toBeNull();
    expect(listed.body.state.defaultPresetId).toBe(presetId);

    const exported = await account.exportData(userId);
    expect(exported.cosmetics.presets).toEqual(
      expect.objectContaining({
        state: expect.objectContaining({ defaultPresetId: presetId, activePresetId: null }),
        activations: expect.arrayContaining([
          expect.objectContaining({ idempotencyKey }),
          expect.objectContaining({ idempotencyKey: secondIdempotencyKey })
        ])
      })
    );

    await account.deleteAccount(userId, { password: 'KnowMeTest123!' });
    expect(await prisma.cosmeticPreset.count({ where: { userId } })).toBe(0);
    expect(await prisma.cosmeticPresetState.count({ where: { userId } })).toBe(0);
    expect(await prisma.cosmeticPresetActivation.count({ where: { userId } })).toBe(0);
  });
});

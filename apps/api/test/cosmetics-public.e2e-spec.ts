import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe public cosmetics (e2e)', () => {
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
        email: `${name}@public-cosmetics.knowme.test`,
        username: `public_cosmetics_${name}`,
        displayName: `Public Cosmetics ${name}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('caps visibility, hides selected slots and falls back for inactive assets', async () => {
    const admin = await register('admin');
    const owner = await register('owner');
    const friend = await register('friend');
    const stranger = await register('stranger');
    const adminToken = admin.body.accessToken as string;
    const ownerToken = owner.body.accessToken as string;
    const friendToken = friend.body.accessToken as string;
    const strangerToken = stranger.body.accessToken as string;
    const adminId = admin.body.user.id as string;
    const ownerId = owner.body.user.id as string;
    const friendId = friend.body.user.id as string;
    const ownerUsername = owner.body.user.username as string;

    await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });

    const frame = await request(app.getHttpServer())
      .post('/admin/cosmetics/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'public-aurora-frame',
        version: 1,
        name: 'Cadre Aurore public',
        description: 'Cadre de profil visuel.',
        slot: 'AVATAR_FRAME',
        rarity: 'RARE',
        assetUrl: '/assets/cosmetics/public-aurora-frame-v1.json',
        previewUrl: '/assets/cosmetics/public-aurora-frame-v1.webp',
        active: true,
        reason: 'Objet de validation du rendu public.'
      })
      .expect(201);

    const background = await request(app.getHttpServer())
      .post('/admin/cosmetics/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'public-nebula-background',
        version: 1,
        name: 'Fond Nébuleuse public',
        description: 'Fond de profil visuel.',
        slot: 'PROFILE_BACKGROUND',
        rarity: 'EPIC',
        assetUrl: '/assets/cosmetics/public-nebula-background-v1.json',
        previewUrl: '/assets/cosmetics/public-nebula-background-v1.webp',
        active: true,
        reason: 'Second objet de validation du rendu public.'
      })
      .expect(201);

    for (const itemId of [frame.body.id, background.body.id]) {
      await request(app.getHttpServer())
        .post('/admin/cosmetics/grants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: ownerId,
          itemId,
          source: 'EVENT',
          reason: 'Attribution visuelle pour le test de profil public.'
        })
        .expect(201);
    }

    await request(app.getHttpServer())
      .put('/cosmetics/equipment/AVATAR_FRAME')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ itemId: frame.body.id })
      .expect(200);
    await request(app.getHttpServer())
      .put('/cosmetics/equipment/PROFILE_BACKGROUND')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ itemId: background.body.id })
      .expect(200);

    const privateForStranger = await request(app.getHttpServer())
      .get(`/cosmetics/public/${ownerUsername}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(200);
    expect(privateForStranger.body).toEqual(
      expect.objectContaining({
        visible: false,
        visibility: 'FRIENDS',
        slots: [],
        profile: expect.objectContaining({ username: ownerUsername, avatarUrl: null })
      })
    );

    const ownerPreview = await request(app.getHttpServer())
      .get(`/cosmetics/public/${ownerUsername}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(ownerPreview.body).toEqual(
      expect.objectContaining({
        visible: true,
        viewerContext: 'OWNER',
        slots: expect.arrayContaining([
          expect.objectContaining({
            slot: 'AVATAR_FRAME',
            fallback: false,
            item: expect.objectContaining({ id: frame.body.id })
          }),
          expect.objectContaining({
            slot: 'PROFILE_BACKGROUND',
            fallback: false,
            item: expect.objectContaining({ id: background.body.id })
          })
        ])
      })
    );

    await prisma.friendship.create({
      data: {
        requesterId: friendId,
        addresseeId: ownerId,
        status: 'ACCEPTED'
      }
    });
    const friendPreview = await request(app.getHttpServer())
      .get(`/cosmetics/public/${ownerUsername}`)
      .set('Authorization', `Bearer ${friendToken}`)
      .expect(200);
    expect(friendPreview.body.visible).toBe(true);
    expect(friendPreview.body.viewerContext).toBe('FRIEND');
    expect(friendPreview.body.slots).toHaveLength(2);

    const publicPreference = await request(app.getHttpServer())
      .patch('/privacy/preferences')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        profileVisibility: 'PUBLIC',
        cosmeticVisibility: 'PUBLIC',
        hiddenCosmeticSlots: ['AVATAR_FRAME']
      })
      .expect(200);
    expect(publicPreference.body).toEqual(
      expect.objectContaining({
        profileVisibility: 'PUBLIC',
        cosmeticVisibility: 'PUBLIC',
        hiddenCosmeticSlots: ['AVATAR_FRAME']
      })
    );

    const publicSnapshot = await request(app.getHttpServer())
      .get(`/cosmetics/public/${ownerUsername}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(200);
    expect(publicSnapshot.body.visible).toBe(true);
    expect(publicSnapshot.body.viewerContext).toBe('PUBLIC');
    expect(publicSnapshot.body.slots).toEqual([
      expect.objectContaining({
        slot: 'PROFILE_BACKGROUND',
        item: expect.objectContaining({ id: background.body.id }),
        fallback: false
      })
    ]);
    expect(JSON.stringify(publicSnapshot.body)).not.toContain('EVENT');
    expect(JSON.stringify(publicSnapshot.body)).not.toContain('priceKnowCoins');
    expect(publicSnapshot.body.rules).toEqual(
      expect.objectContaining({
        serverResolved: true,
        acquisitionSourceExposed: false,
        purchasePriceExposed: false,
        profileVisibilityIsUpperBound: true,
        hiddenSlotsOmitted: true,
        inactiveAssetsFallbackSafely: true,
        gameplayEffectsAllowed: false,
        paidPriorityAllowed: false
      })
    );

    await request(app.getHttpServer())
      .patch('/privacy/preferences')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ profileVisibility: 'PRIVATE', cosmeticVisibility: 'PUBLIC' })
      .expect(200);

    const cappedSnapshot = await request(app.getHttpServer())
      .get(`/cosmetics/public/${ownerUsername}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(200);
    expect(cappedSnapshot.body.visible).toBe(false);
    expect(cappedSnapshot.body.visibility).toBe('PRIVATE');

    await request(app.getHttpServer())
      .patch('/privacy/preferences')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        profileVisibility: 'PUBLIC',
        cosmeticVisibility: 'FOLLOW_PROFILE',
        hiddenCosmeticSlots: []
      })
      .expect(200);
    await prisma.cosmeticItemDefinition.update({
      where: { id: background.body.id },
      data: { active: false }
    });

    const fallbackSnapshot = await request(app.getHttpServer())
      .get(`/cosmetics/public/${ownerUsername}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(200);
    expect(fallbackSnapshot.body.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slot: 'AVATAR_FRAME',
          fallback: false,
          item: expect.objectContaining({ id: frame.body.id })
        }),
        expect.objectContaining({
          slot: 'PROFILE_BACKGROUND',
          item: null,
          fallback: true,
          fallbackReason: 'ASSET_UNAVAILABLE'
        })
      ])
    );

    const exported = await account.exportData(ownerId);
    expect(exported.privacy.preferences).toEqual(
      expect.objectContaining({
        cosmeticVisibility: 'FOLLOW_PROFILE',
        hiddenCosmeticSlots: []
      })
    );

    expect(
      await prisma.auditLog.count({
        where: {
          actorId: ownerId,
          action: 'PRIVACY_PREFERENCES_UPDATE'
        }
      })
    ).toBe(3);

    await account.deleteAccount(ownerId, { password: 'KnowMeTest123!' });
    expect(await prisma.privacyPreference.count({ where: { userId: ownerId } })).toBe(0);
    expect(await prisma.cosmeticEquipment.count({ where: { userId: ownerId } })).toBe(0);
  });
});

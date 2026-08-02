import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe cosmetics inventory (e2e)', () => {
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
    await prisma.cosmeticOwnership.deleteMany();
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
        email: `${name}@cosmetics.knowme.test`,
        username: `cosmetics_${name}`,
        displayName: `Cosmetics ${name}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('separates definitions, ownership and visual equipment without purchases', async () => {
    const admin = await register('admin');
    const member = await register('member');
    const outsider = await register('outsider');
    const adminToken = admin.body.accessToken as string;
    const memberToken = member.body.accessToken as string;
    const outsiderToken = outsider.body.accessToken as string;
    const adminId = admin.body.user.id as string;
    const memberId = member.body.user.id as string;

    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN' }
    });

    const itemPayload = {
      key: 'aurora-avatar-frame',
      version: 1,
      name: 'Cadre Aurore',
      description: 'Un cadre purement visuel aux reflets doux.',
      slot: 'AVATAR_FRAME',
      rarity: 'RARE',
      assetUrl: '/assets/cosmetics/aurora-frame-v1.json',
      previewUrl: '/assets/cosmetics/aurora-frame-v1.webp',
      active: true,
      reason: 'Publication initiale du catalogue cosmétique autoritaire.'
    };

    await request(app.getHttpServer())
      .post('/admin/cosmetics/items')
      .set('Authorization', `Bearer ${memberToken}`)
      .send(itemPayload)
      .expect(403);

    const item = await request(app.getHttpServer())
      .post('/admin/cosmetics/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(itemPayload)
      .expect(201);
    expect(item.body).toEqual(
      expect.objectContaining({
        key: 'aurora-avatar-frame',
        version: 1,
        slot: 'AVATAR_FRAME',
        rarity: 'RARE',
        active: true
      })
    );

    await request(app.getHttpServer())
      .post('/admin/cosmetics/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(itemPayload)
      .expect(409);

    const catalog = await request(app.getHttpServer())
      .get('/cosmetics/catalog')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(catalog.body).toEqual(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ id: item.body.id, key: 'aurora-avatar-frame' })
        ]),
        rules: expect.objectContaining({
          visualOnly: true,
          gameplayEffectsAllowed: false,
          purchasesEnabled: false,
          paidPriorityAllowed: false,
          ownershipRequired: true,
          serverAuthoritativeInventory: true
        })
      })
    );

    await request(app.getHttpServer())
      .put('/cosmetics/equipment/AVATAR_FRAME')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ itemId: item.body.id })
      .expect(403);

    const grant = await request(app.getHttpServer())
      .post('/admin/cosmetics/grants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: memberId,
        itemId: item.body.id,
        source: 'EVENT',
        externalReference: 'launch-2026',
        reason: 'Attribution de lancement sans achat.'
      })
      .expect(201);
    expect(grant.body).toEqual(
      expect.objectContaining({
        replayed: false,
        reactivated: false,
        ownership: expect.objectContaining({
          userId: memberId,
          itemId: item.body.id,
          source: 'EVENT'
        })
      })
    );

    const replay = await request(app.getHttpServer())
      .post('/admin/cosmetics/grants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: memberId,
        itemId: item.body.id,
        source: 'EVENT',
        externalReference: 'launch-2026',
        reason: 'Rejeu idempotent de la même attribution.'
      })
      .expect(201);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.ownership.id).toBe(grant.body.ownership.id);

    await request(app.getHttpServer())
      .put('/cosmetics/equipment/CHAT_BUBBLE')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ itemId: item.body.id })
      .expect(400);

    const equipped = await request(app.getHttpServer())
      .put('/cosmetics/equipment/AVATAR_FRAME')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ itemId: item.body.id })
      .expect(200);
    expect(equipped.body).toEqual(
      expect.objectContaining({
        slot: 'AVATAR_FRAME',
        replayed: false,
        item: expect.objectContaining({ id: item.body.id })
      })
    );

    const mine = await request(app.getHttpServer())
      .get('/cosmetics/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(mine.body.inventory).toEqual([
      expect.objectContaining({
        id: grant.body.ownership.id,
        equipped: true,
        item: expect.objectContaining({ id: item.body.id })
      })
    ]);
    expect(mine.body.equipment).toEqual([
      expect.objectContaining({ slot: 'AVATAR_FRAME', itemId: item.body.id })
    ]);

    const outsiderInventory = await request(app.getHttpServer())
      .get('/cosmetics/me')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(200);
    expect(outsiderInventory.body.inventory).toHaveLength(0);
    expect(outsiderInventory.body.equipment).toHaveLength(0);

    const exported = await account.exportData(memberId);
    expect(exported.formatVersion).toBe(7);
    expect(exported.cosmetics.ownerships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: grant.body.ownership.id, itemId: item.body.id })
      ])
    );
    expect(exported.cosmetics.equipment).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: 'AVATAR_FRAME', itemId: item.body.id })
      ])
    );

    const revoked = await request(app.getHttpServer())
      .patch(`/admin/cosmetics/grants/${grant.body.ownership.id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Révocation contrôlée pour vérifier le déséquipement.' })
      .expect(200);
    expect(revoked.body).toEqual(
      expect.objectContaining({ replayed: false, unequippedSlots: 1 })
    );

    const afterRevoke = await request(app.getHttpServer())
      .get('/cosmetics/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(afterRevoke.body.inventory).toHaveLength(0);
    expect(afterRevoke.body.equipment).toHaveLength(0);

    const reactivated = await request(app.getHttpServer())
      .post('/admin/cosmetics/grants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: memberId,
        itemId: item.body.id,
        source: 'ADMIN',
        reason: 'Restauration contrôlée avant le test de suppression.'
      })
      .expect(201);
    expect(reactivated.body.reactivated).toBe(true);

    await request(app.getHttpServer())
      .put('/cosmetics/equipment/AVATAR_FRAME')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ itemId: item.body.id })
      .expect(200);

    expect(
      await prisma.auditLog.count({
        where: {
          actorId: adminId,
          action: {
            in: [
              'COSMETIC_ITEM_PUBLISHED',
              'COSMETIC_OWNERSHIP_GRANTED',
              'COSMETIC_OWNERSHIP_REVOKED',
              'COSMETIC_OWNERSHIP_REACTIVATED'
            ]
          }
        }
      })
    ).toBe(4);

    await account.deleteAccount(memberId, { password: 'KnowMeTest123!' });
    expect(await prisma.cosmeticOwnership.count({ where: { userId: memberId } })).toBe(0);
    expect(await prisma.cosmeticEquipment.count({ where: { userId: memberId } })).toBe(0);
  });
});

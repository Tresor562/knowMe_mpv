import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe authoritative cosmetics (e2e)', () => {
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
      'TRUNCATE TABLE "CosmeticEquipment", "CosmeticGrant", "CosmeticDefinition", "User" RESTART IDENTITY CASCADE'
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "CosmeticEquipment", "CosmeticGrant", "CosmeticDefinition", "User" RESTART IDENTITY CASCADE'
    );
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

  it('separates catalog, ownership and visual equipment without purchases', async () => {
    const admin = await register('admin');
    const member = await register('member');
    const adminToken = admin.body.accessToken as string;
    const memberToken = member.body.accessToken as string;
    const adminId = admin.body.user.id as string;
    const memberId = member.body.user.id as string;
    await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });

    await request(app.getHttpServer())
      .post('/admin/cosmetics/definitions')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        key: 'nexus-frame',
        version: 1,
        type: 'AVATAR_FRAME',
        slot: 'AVATAR_FRAME',
        name: 'Cadre Nexus',
        description: 'Un cadre purement visuel pour le profil KnowMe.',
        assetUrl: 'https://cdn.knowme.test/cosmetics/nexus-frame-v1.json',
        reason: 'Tentative non autorisée.'
      })
      .expect(403);

    const definition = await request(app.getHttpServer())
      .post('/admin/cosmetics/definitions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'nexus-frame',
        version: 1,
        type: 'AVATAR_FRAME',
        slot: 'AVATAR_FRAME',
        name: 'Cadre Nexus',
        description: 'Un cadre purement visuel pour le profil KnowMe.',
        assetUrl: 'https://cdn.knowme.test/cosmetics/nexus-frame-v1.json',
        rarity: 'EPIC',
        metadata: { palette: 'nexus' },
        active: true,
        reason: 'Premier objet du catalogue cosmétique unifié.'
      })
      .expect(201);

    const firstGrant = await request(app.getHttpServer())
      .post('/admin/cosmetics/grants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: memberId,
        definitionId: definition.body.id,
        source: 'KMD_027_E2E',
        reason: 'Attribution vérifiée pour le test du registre.',
        idempotencyKey: `cosmetic:${memberId}:nexus-frame:v1`
      })
      .expect(201);
    expect(firstGrant.body.replayed).toBe(false);

    const replay = await request(app.getHttpServer())
      .post('/admin/cosmetics/grants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: memberId,
        definitionId: definition.body.id,
        source: 'KMD_027_E2E',
        reason: 'Rejeu idempotent de la même attribution.',
        idempotencyKey: `cosmetic:${memberId}:nexus-frame:v1`
      })
      .expect(201);
    expect(replay.body.replayed).toBe(true);
    expect(await prisma.cosmeticGrant.count({ where: { userId: memberId } })).toBe(1);

    const inventory = await request(app.getHttpServer())
      .get('/cosmetics/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(inventory.body).toEqual(
      expect.objectContaining({
        available: [
          expect.objectContaining({
            id: firstGrant.body.grant.id,
            definition: expect.objectContaining({
              slot: 'AVATAR_FRAME',
              rarity: 'EPIC'
            })
          })
        ],
        equipment: [],
        rules: {
          serverAuthoritative: true,
          purelyVisual: true,
          purchasesEnabled: false,
          premiumPowerAllowed: false,
          clientGrantedOwnershipAllowed: false,
          oneEquippedItemPerSlot: true
        }
      })
    );

    await request(app.getHttpServer())
      .patch('/cosmetics/equipment/PROFILE_THEME')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ grantId: firstGrant.body.grant.id })
      .expect(400);

    const equipped = await request(app.getHttpServer())
      .patch('/cosmetics/equipment/AVATAR_FRAME')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ grantId: firstGrant.body.grant.id })
      .expect(200);
    expect(equipped.body.equipment).toEqual([
      expect.objectContaining({
        slot: 'AVATAR_FRAME',
        grantId: firstGrant.body.grant.id
      })
    ]);

    const exported = await account.exportData(memberId);
    expect(exported.formatVersion).toBe(7);
    expect(exported.cosmetics.grants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstGrant.body.grant.id })
      ])
    );
    expect(exported.cosmetics.equipment).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: 'AVATAR_FRAME' })
      ])
    );

    const revoked = await request(app.getHttpServer())
      .patch(`/admin/cosmetics/grants/${firstGrant.body.grant.id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Révocation contrôlée avec déséquipement immédiat.' })
      .expect(200);
    expect(revoked.body).toEqual(
      expect.objectContaining({
        replayed: false,
        grant: expect.objectContaining({
          revokedById: adminId,
          equipment: null
        })
      })
    );

    const afterRevoke = await request(app.getHttpServer())
      .get('/cosmetics/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(afterRevoke.body.available).toEqual([]);
    expect(afterRevoke.body.equipment).toEqual([]);
    expect(afterRevoke.body.history[0].revokedAt).toBeDefined();

    expect(
      await prisma.auditLog.count({
        where: {
          action: {
            in: [
              'COSMETIC_DEFINITION_CREATED',
              'COSMETIC_GRANTED',
              'COSMETIC_EQUIPPED',
              'COSMETIC_GRANT_REVOKED'
            ]
          }
        }
      })
    ).toBe(4);

    await account.deleteAccount(memberId, { password: 'KnowMeTest123!' });
    expect(await prisma.cosmeticGrant.count({ where: { userId: memberId } })).toBe(0);
    expect(await prisma.cosmeticEquipment.count({ where: { userId: memberId } })).toBe(0);
  });
});

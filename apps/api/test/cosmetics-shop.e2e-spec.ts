import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe cosmetic shop (e2e)', () => {
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
        email: `${name}@cosmetic-shop.knowme.test`,
        username: `shop_${name}`,
        displayName: `Shop ${name}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  async function seedBalance(userId: string, balance: number) {
    await prisma.user.update({ where: { id: userId }, data: { knowCoins: balance } });
    await prisma.knowCoinWallet.upsert({
      where: { userId },
      create: { userId, balance },
      update: { balance }
    });
  }

  it('debits once and grants ownership atomically with an idempotent receipt', async () => {
    const admin = await register('admin');
    const buyer = await register('buyer');
    const poor = await register('poor');
    const adminToken = admin.body.accessToken as string;
    const buyerToken = buyer.body.accessToken as string;
    const poorToken = poor.body.accessToken as string;
    const adminId = admin.body.user.id as string;
    const buyerId = buyer.body.user.id as string;
    const poorId = poor.body.user.id as string;

    await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
    await seedBalance(buyerId, 500);
    await seedBalance(poorId, 25);

    const item = await request(app.getHttpServer())
      .post('/admin/cosmetics/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'nebula-chat-bubble',
        version: 1,
        name: 'Bulle Nébuleuse',
        description: 'Une bulle de discussion purement visuelle.',
        slot: 'CHAT_BUBBLE',
        rarity: 'EPIC',
        assetUrl: '/assets/cosmetics/nebula-chat-bubble-v1.json',
        previewUrl: '/assets/cosmetics/nebula-chat-bubble-v1.webp',
        active: true,
        reason: 'Publication de l’objet de validation de la boutique.'
      })
      .expect(201);

    const offerPayload = {
      key: 'nebula-chat-bubble-offer',
      version: 1,
      itemId: item.body.id,
      priceKnowCoins: 120,
      active: true,
      reason: 'Première offre KnowCoins du catalogue cosmétique.'
    };

    await request(app.getHttpServer())
      .post('/admin/cosmetics/offers')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(offerPayload)
      .expect(403);

    const offer = await request(app.getHttpServer())
      .post('/admin/cosmetics/offers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(offerPayload)
      .expect(201);
    expect(offer.body).toEqual(
      expect.objectContaining({
        key: offerPayload.key,
        version: 1,
        itemId: item.body.id,
        priceKnowCoins: 120,
        active: true
      })
    );

    await request(app.getHttpServer())
      .post('/admin/cosmetics/offers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(offerPayload)
      .expect(409);

    const shop = await request(app.getHttpServer())
      .get('/cosmetics/shop')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);
    expect(shop.body).toEqual(
      expect.objectContaining({
        wallet: expect.objectContaining({ balance: 500 }),
        offers: [
          expect.objectContaining({
            id: offer.body.id,
            itemId: item.body.id,
            priceKnowCoins: 120,
            owned: false,
            affordable: true
          })
        ],
        rules: expect.objectContaining({
          currency: 'KNOWCOINS',
          verifiedLedgerRequired: true,
          atomicDebitAndOwnership: true,
          idempotentPurchases: true,
          visualOnly: true,
          gameplayEffectsAllowed: false,
          paidPriorityAllowed: false,
          socialVisibilityBoostAllowed: false,
          premiumBypassAllowed: false
        })
      })
    );

    const purchasePayload = {
      offerId: offer.body.id,
      clientPurchaseId: 'buyer-nebula-0001'
    };
    const purchase = await request(app.getHttpServer())
      .post('/cosmetics/shop/purchases')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(purchasePayload)
      .expect(201);
    expect(purchase.body).toEqual(
      expect.objectContaining({
        replayed: false,
        receipt: expect.objectContaining({
          userId: buyerId,
          offerId: offer.body.id,
          itemId: item.body.id,
          priceKnowCoins: 120
        }),
        ownership: expect.objectContaining({
          userId: buyerId,
          itemId: item.body.id,
          source: 'PURCHASE'
        }),
        ledgerEntry: expect.objectContaining({
          userId: buyerId,
          amount: -120,
          balanceBefore: 500,
          balanceAfter: 380,
          type: 'COSMETIC_PURCHASE',
          source: 'COSMETICS_SHOP'
        })
      })
    );

    const replay = await request(app.getHttpServer())
      .post('/cosmetics/shop/purchases')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(purchasePayload)
      .expect(201);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.receipt.id).toBe(purchase.body.receipt.id);
    expect(replay.body.ledgerEntry.id).toBe(purchase.body.ledgerEntry.id);

    expect(
      await prisma.knowCoinLedgerEntry.count({
        where: { userId: buyerId, type: 'COSMETIC_PURCHASE' }
      })
    ).toBe(1);
    expect(await prisma.cosmeticPurchaseReceipt.count({ where: { userId: buyerId } })).toBe(1);
    expect(
      await prisma.cosmeticOwnership.count({
        where: { userId: buyerId, itemId: item.body.id, revokedAt: null }
      })
    ).toBe(1);

    const wallet = await request(app.getHttpServer())
      .get('/wallet/me')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);
    expect(wallet.body.balance).toBe(380);

    const afterPurchaseShop = await request(app.getHttpServer())
      .get('/cosmetics/shop')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);
    expect(afterPurchaseShop.body.offers[0]).toEqual(
      expect.objectContaining({ owned: true, affordable: true })
    );

    const history = await request(app.getHttpServer())
      .get('/cosmetics/shop/purchases')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);
    expect(history.body.receipts).toEqual([
      expect.objectContaining({
        id: purchase.body.receipt.id,
        priceKnowCoins: 120,
        item: expect.objectContaining({ id: item.body.id })
      })
    ]);

    await request(app.getHttpServer())
      .post('/cosmetics/shop/purchases')
      .set('Authorization', `Bearer ${poorToken}`)
      .send({ offerId: offer.body.id, clientPurchaseId: 'poor-nebula-0001' })
      .expect(400);
    expect(await prisma.cosmeticPurchaseReceipt.count({ where: { userId: poorId } })).toBe(0);
    expect(await prisma.cosmeticOwnership.count({ where: { userId: poorId } })).toBe(0);
    expect(
      await prisma.knowCoinLedgerEntry.count({
        where: { userId: poorId, type: 'COSMETIC_PURCHASE' }
      })
    ).toBe(0);
    expect((await prisma.knowCoinWallet.findUnique({ where: { userId: poorId } }))?.balance).toBe(25);

    const exported = await account.exportData(buyerId);
    expect(exported.cosmetics.purchaseReceipts).toEqual([
      expect.objectContaining({ id: purchase.body.receipt.id, itemId: item.body.id })
    ]);

    expect(
      await prisma.auditLog.count({
        where: {
          action: { in: ['COSMETIC_OFFER_PUBLISHED', 'COSMETIC_PURCHASE_COMPLETED'] },
          OR: [{ actorId: adminId }, { actorId: buyerId }]
        }
      })
    ).toBe(2);

    await account.deleteAccount(buyerId, { password: 'KnowMeTest123!' });
    expect(await prisma.cosmeticPurchaseReceipt.count({ where: { userId: buyerId } })).toBe(0);
    expect(await prisma.cosmeticOwnership.count({ where: { userId: buyerId } })).toBe(0);
  });
});

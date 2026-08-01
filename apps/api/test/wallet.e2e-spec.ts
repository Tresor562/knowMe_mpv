import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe KnowCoins wallet (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@wallet.knowme.test`,
        username: `wallet_${index}`,
        displayName: `Wallet ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('keeps an idempotent, non-negative and server-authoritative ledger', async () => {
    const admin = await register('admin');
    const member = await register('member');

    await prisma.user.update({
      where: { id: admin.body.user.id },
      data: { role: 'ADMIN' }
    });

    const adminToken = admin.body.accessToken as string;
    const memberToken = member.body.accessToken as string;
    const memberId = member.body.user.id as string;

    const initial = await request(app.getHttpServer())
      .get('/wallet/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(initial.body).toEqual(
      expect.objectContaining({ accountId: memberId, balance: 0, version: 0 })
    );

    await prisma.user.update({
      where: { id: memberId },
      data: { knowCoins: 999999 }
    });

    const authoritativeProfile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(authoritativeProfile.body.knowCoins).toBe(0);

    await request(app.getHttpServer())
      .post('/admin/wallet/adjustments')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-role', 'ADMIN')
      .set('x-permissions', 'wallet.manage')
      .send({
        userId: memberId,
        amount: 100,
        idempotencyKey: 'wallet-member-credit-0001',
        reason: 'Tentative de crédit depuis un client modifié.'
      })
      .expect(403);

    const credit = await request(app.getHttpServer())
      .post('/admin/wallet/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-request-id', 'wallet-credit-request-20260801')
      .send({
        userId: memberId,
        amount: 100,
        idempotencyKey: 'wallet-member-credit-0001',
        reason: 'Crédit de validation du registre.',
        referenceType: 'TEST_CASE',
        referenceId: 'wallet-e2e-credit'
      })
      .expect(201);

    expect(credit.body).toEqual({
      entry: expect.objectContaining({
        userId: memberId,
        amount: 100,
        balanceBefore: 0,
        balanceAfter: 100,
        idempotencyKey: 'wallet-member-credit-0001'
      }),
      replayed: false
    });

    const replay = await request(app.getHttpServer())
      .post('/admin/wallet/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: memberId,
        amount: 100,
        idempotencyKey: 'wallet-member-credit-0001',
        reason: 'Rejeu volontaire de la même opération.'
      })
      .expect(201);

    expect(replay.body.replayed).toBe(true);
    expect(replay.body.entry.id).toBe(credit.body.entry.id);

    await request(app.getHttpServer())
      .post('/admin/wallet/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: memberId,
        amount: 101,
        idempotencyKey: 'wallet-member-credit-0001',
        reason: 'Réutilisation incohérente de la clé.'
      })
      .expect(400);

    const debit = await request(app.getHttpServer())
      .post('/admin/wallet/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-request-id', 'wallet-debit-request-20260801')
      .send({
        userId: memberId,
        amount: -40,
        idempotencyKey: 'wallet-member-debit-0001',
        reason: 'Débit de validation du registre.'
      })
      .expect(201);

    expect(debit.body.entry).toEqual(
      expect.objectContaining({
        amount: -40,
        balanceBefore: 100,
        balanceAfter: 60
      })
    );

    await request(app.getHttpServer())
      .post('/admin/wallet/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: memberId,
        amount: -100,
        idempotencyKey: 'wallet-member-debit-0002',
        reason: 'Débit supérieur au solde disponible.'
      })
      .expect(400);

    const wallet = await request(app.getHttpServer())
      .get('/wallet/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(wallet.body).toEqual(
      expect.objectContaining({ accountId: memberId, balance: 60, version: 2 })
    );

    const history = await request(app.getHttpServer())
      .get('/wallet/history')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(history.body.items).toHaveLength(2);
    expect(history.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: 100, balanceBefore: 0, balanceAfter: 100 }),
        expect.objectContaining({ amount: -40, balanceBefore: 100, balanceAfter: 60 })
      ])
    );

    const profile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(profile.body.knowCoins).toBe(60);

    const [storedWallet, storedUser, ledgerCount, auditCount] = await Promise.all([
      prisma.knowCoinWallet.findUnique({ where: { userId: memberId } }),
      prisma.user.findUnique({ where: { id: memberId }, select: { knowCoins: true } }),
      prisma.knowCoinLedgerEntry.count({ where: { userId: memberId } }),
      prisma.auditLog.count({
        where: {
          targetAccountId: memberId,
          action: 'KNOWCOIN_ADMIN_ADJUSTMENT'
        }
      })
    ]);

    expect(storedWallet?.balance).toBe(60);
    expect(storedUser?.knowCoins).toBe(60);
    expect(ledgerCount).toBe(2);
    expect(auditCount).toBe(2);

    const audit = await request(app.getHttpServer())
      .get('/admin/audit-logs?requestId=wallet-credit-request-20260801')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(audit.body).toEqual([
      expect.objectContaining({
        action: 'KNOWCOIN_ADMIN_ADJUSTMENT',
        targetAccountId: memberId,
        requestId: 'wallet-credit-request-20260801'
      })
    ]);
  });
});

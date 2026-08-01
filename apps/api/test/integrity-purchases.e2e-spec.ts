import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const ATTESTATION_SECRET = 'knowme-test-attestation-secret-2026';
const PURCHASE_SECRET = 'knowme-test-purchase-secret-2026';
const APP_ID = 'com.knowme.app';

process.env.NODE_ENV = 'test';
process.env.ALLOW_TEST_ATTESTATION = 'true';
process.env.TEST_ATTESTATION_SECRET = ATTESTATION_SECRET;
process.env.ALLOW_TEST_PURCHASES = 'true';
process.env.TEST_PURCHASE_SECRET = PURCHASE_SECRET;
process.env.ANDROID_APP_ID = APP_ID;

type Session = {
  accessToken: string;
  user: { id: string };
};

function signedToken(payload: object, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('hex');
  return `test.${encoded}.${signature}`;
}

describe('KnowMe application integrity and purchases (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.purchaseReceipt.deleteMany();
    await prisma.storeProduct.deleteMany();
    await prisma.deviceAttestation.deleteMany();
    await prisma.deviceAttestationChallenge.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(label: string): Promise<Session> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${label}@integrity.knowme.test`,
        username: `integrity_${label}`,
        displayName: `Integrity ${label}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
    return response.body as Session;
  }

  async function attest(
    session: Session,
    action = 'purchase.verify',
    deviceId = `android-${session.user.id}`
  ) {
    const challenge = await request(app.getHttpServer())
      .post('/integrity/challenges')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ platform: 'ANDROID', action })
      .expect(201);

    const token = signedToken(
      {
        nonce: challenge.body.nonce,
        platform: 'ANDROID',
        action,
        deviceId,
        appIdentifier: APP_ID,
        verdict: 'MEETS_DEVICE_INTEGRITY',
        issuedAt: new Date().toISOString()
      },
      ATTESTATION_SECRET
    );

    const verified = await request(app.getHttpServer())
      .post('/integrity/verify')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        nonce: challenge.body.nonce,
        token,
        platform: 'ANDROID',
        action,
        deviceId,
        appIdentifier: APP_ID
      })
      .expect(201);

    return {
      id: verified.body.id as string,
      nonce: challenge.body.nonce as string,
      token
    };
  }

  function receipt(
    transactionId: string,
    externalProductId: string,
    expiresAt?: Date
  ) {
    return signedToken(
      {
        transactionId,
        originalTransactionId: transactionId,
        externalProductId,
        status: 'PURCHASED',
        purchasedAt: new Date().toISOString(),
        ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {})
      },
      PURCHASE_SECRET
    );
  }

  it('binds attestations to one challenge, one session, one app and one action', async () => {
    const user = await register('attestation');
    const challenge = await request(app.getHttpServer())
      .post('/integrity/challenges')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ platform: 'ANDROID', action: 'purchase.verify' })
      .expect(201);

    const payload = {
      nonce: challenge.body.nonce,
      platform: 'ANDROID',
      action: 'purchase.verify',
      deviceId: 'android-attestation-device',
      appIdentifier: APP_ID,
      verdict: 'MEETS_DEVICE_INTEGRITY',
      issuedAt: new Date().toISOString()
    };
    const token = signedToken(payload, ATTESTATION_SECRET);

    await request(app.getHttpServer())
      .post('/integrity/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ ...payload, token })
      .expect(201);

    await request(app.getHttpServer())
      .post('/integrity/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ ...payload, token })
      .expect(401);

    const second = await request(app.getHttpServer())
      .post('/integrity/challenges')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ platform: 'ANDROID', action: 'purchase.verify' })
      .expect(201);

    const forged = signedToken(
      { ...payload, nonce: second.body.nonce },
      'wrong-secret-that-is-long-enough'
    );
    await request(app.getHttpServer())
      .post('/integrity/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ ...payload, nonce: second.body.nonce, token: forged })
      .expect(401);
  });

  it('awards an entitlement exactly once and rejects cross-account receipt replay', async () => {
    const buyer = await register('premium-buyer');
    const attacker = await register('premium-attacker');
    const buyerAttestation = await attest(buyer);
    const attackerAttestation = await attest(attacker);

    await prisma.storeProduct.create({
      data: {
        key: 'premium.monthly.android',
        provider: 'GOOGLE',
        platform: 'ANDROID',
        externalProductId: 'knowme_premium_monthly',
        name: 'KnowMe Premium mensuel',
        kind: 'ENTITLEMENT',
        entitlementKey: 'premium.core',
        durationDays: 30,
        active: true
      }
    });

    const rawReceipt = receipt('gpa-entitlement-0001', 'knowme_premium_monthly');
    const body = {
      productKey: 'premium.monthly.android',
      provider: 'GOOGLE',
      platform: 'ANDROID',
      receipt: rawReceipt,
      attestationId: buyerAttestation.id
    };

    const first = await request(app.getHttpServer())
      .post('/purchases/verify')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send(body)
      .expect(201);
    expect(first.body.replayed).toBe(false);
    expect(first.body.receipt.entitlementGrantId).toEqual(expect.any(String));

    const replay = await request(app.getHttpServer())
      .post('/purchases/verify')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send(body)
      .expect(201);
    expect(replay.body.replayed).toBe(true);

    const grants = await request(app.getHttpServer())
      .get('/entitlements/me')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .expect(200);
    expect(grants.body.entitlements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'premium.core', source: 'PURCHASE' })
      ])
    );

    await request(app.getHttpServer())
      .post('/purchases/verify')
      .set('Authorization', `Bearer ${attacker.accessToken}`)
      .send({ ...body, attestationId: attackerAttestation.id })
      .expect(409);

    expect(await prisma.purchaseReceipt.count()).toBe(1);
    expect(await prisma.entitlementGrant.count({ where: { userId: buyer.user.id } })).toBe(1);

    const stored = await prisma.purchaseReceipt.findFirstOrThrow();
    expect(JSON.stringify(stored)).not.toContain(rawReceipt);
  });

  it('credits concurrent KnowCoins purchases once and enforces action binding', async () => {
    const buyer = await register('coins-buyer');
    const purchaseAttestation = await attest(buyer, 'purchase.verify');
    const unrelatedAttestation = await attest(buyer, 'profile.update', 'other-device');

    await prisma.storeProduct.create({
      data: {
        key: 'coins.250.android',
        provider: 'GOOGLE',
        platform: 'ANDROID',
        externalProductId: 'knowme_coins_250',
        name: '250 KnowCoins',
        kind: 'KNOWCOINS',
        coinAmount: 250,
        active: true
      }
    });

    const rawReceipt = receipt('gpa-coins-0001', 'knowme_coins_250');
    const payload = {
      productKey: 'coins.250.android',
      provider: 'GOOGLE',
      platform: 'ANDROID',
      receipt: rawReceipt,
      attestationId: purchaseAttestation.id
    };

    await request(app.getHttpServer())
      .post('/purchases/verify')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ ...payload, attestationId: unrelatedAttestation.id })
      .expect(403);

    const [one, two] = await Promise.all([
      request(app.getHttpServer())
        .post('/purchases/verify')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send(payload),
      request(app.getHttpServer())
        .post('/purchases/verify')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send(payload)
    ]);

    expect([one.status, two.status]).toEqual([201, 201]);
    expect([one.body.replayed, two.body.replayed].sort()).toEqual([false, true]);

    const wallet = await request(app.getHttpServer())
      .get('/wallet/me')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .expect(200);
    expect(wallet.body.balance).toBe(250);

    expect(
      await prisma.knowCoinLedgerEntry.count({
        where: { idempotencyKey: 'purchase:google:gpa-coins-0001' }
      })
    ).toBe(1);
    expect(
      await prisma.purchaseReceipt.count({
        where: { transactionId: 'gpa-coins-0001' }
      })
    ).toBe(1);
  });
});

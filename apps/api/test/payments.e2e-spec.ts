import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe payment orchestration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    delete process.env.FLUTTERWAVE_SECRET_KEY;
    delete process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    delete process.env.CINETPAY_API_KEY;
    delete process.env.CINETPAY_SITE_ID;
    delete process.env.CINETPAY_SECRET;
    delete process.env.GOOGLE_PACKAGE_NAME;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.APPLE_KEY_ID;
    delete process.env.APPLE_ISSUER_ID;
    delete process.env.APPLE_PRIVATE_KEY;
    delete process.env.APPLE_BUNDLE_ID;
    delete process.env.APPLE_ROOT_CA_PEMS_JSON;
    delete process.env.PAYMENTS_DATA_ENCRYPTION_KEY;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
    await prisma.paymentFraudLog.deleteMany();
    await prisma.paymentWebhookLog.deleteMany();
    await prisma.paymentRefund.deleteMany();
    await prisma.paymentAttempt.deleteMany();
    await prisma.paymentInvoice.deleteMany();
    await prisma.paymentOrder.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes server prices while refusing unconfigured providers and fake SKUs', async () => {
    const providerState = await request(app.getHttpServer())
      .get('/payments/providers')
      .expect(200);
    expect(providerState.body).toEqual(
      expect.objectContaining({
        pricesAreServerAuthoritative: true,
        clientAmountsAccepted: false,
        storeProofsEncryptedAtRest: true,
        providers: {
          FLUTTERWAVE: expect.objectContaining({ configured: false }),
          CINETPAY: expect.objectContaining({ configured: false }),
          GOOGLE_PLAY: expect.objectContaining({ configured: false }),
          APPLE_APP_STORE: expect.objectContaining({ configured: false })
        }
      })
    );

    const usdCatalog = await request(app.getHttpServer())
      .get('/payments/catalog?platform=WEB&currency=USD')
      .expect(200);
    expect(usdCatalog.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'premium_monthly',
          kind: 'SUBSCRIPTION',
          prices: expect.arrayContaining([
            expect.objectContaining({ unitAmount: 2000, currency: 'USD' })
          ])
        }),
        expect.objectContaining({
          key: 'verified_monthly',
          requiresVerification: true,
          requiresManualReview: true,
          prices: expect.arrayContaining([
            expect.objectContaining({ unitAmount: 2500, currency: 'USD' })
          ])
        })
      ])
    );

    const eurCatalog = await request(app.getHttpServer())
      .get('/payments/catalog?platform=WEB&currency=EUR')
      .expect(200);
    expect(eurCatalog.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'knowcoins_100',
          prices: expect.arrayContaining([
            expect.objectContaining({ unitAmount: 173, currency: 'EUR' })
          ])
        })
      ])
    );

    await request(app.getHttpServer())
      .get('/payments/store/account-reference?provider=GOOGLE_PLAY')
      .expect(401);

    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'payments-member@knowme.test',
        username: 'payments_member',
        displayName: 'Payments Member',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const token = registration.body.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    const googleReference = await request(app.getHttpServer())
      .get('/payments/store/account-reference?provider=GOOGLE_PLAY')
      .set(auth)
      .expect(200);
    expect(googleReference.body).toEqual({
      provider: 'GOOGLE_PLAY',
      accountReference: expect.stringMatching(/^[0-9a-f]{64}$/)
    });

    const appleReference = await request(app.getHttpServer())
      .get('/payments/store/account-reference?provider=APPLE_APP_STORE')
      .set(auth)
      .expect(200);
    expect(appleReference.body).toEqual({
      provider: 'APPLE_APP_STORE',
      accountReference: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      )
    });
    expect(appleReference.body.accountReference).not.toBe(
      googleReference.body.accountReference
    );

    await request(app.getHttpServer())
      .post('/payments/checkout')
      .set(auth)
      .send({ productKey: 'premium_monthly', provider: 'FLUTTERWAVE' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/payments/checkout')
      .set(auth)
      .set('Idempotency-Key', 'checkout-disabled-provider-001')
      .send({ productKey: 'premium_monthly', provider: 'FLUTTERWAVE' })
      .expect(503);

    expect(await prisma.paymentOrder.count()).toBe(0);

    await request(app.getHttpServer())
      .post('/payments/store/verify')
      .set(auth)
      .send({
        productKey: 'premium_monthly',
        provider: 'GOOGLE_PLAY',
        externalProductId: 'unmapped.sku',
        purchaseToken: 'unmapped-purchase-token'
      })
      .expect(404);

    await request(app.getHttpServer())
      .get('/admin/payments/summary')
      .set(auth)
      .expect(403);

    const verifiedPlan = await prisma.billingPlan.findUnique({
      where: { key: 'verified_monthly' },
      include: { entitlements: true }
    });
    expect(verifiedPlan).toEqual(
      expect.objectContaining({
        active: true,
        requiresVerification: true,
        requiresManualReview: true,
        entitlements: expect.arrayContaining([
          expect.objectContaining({ key: 'badge.verified' })
        ])
      })
    );
  });
});

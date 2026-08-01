import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { signBillingPayload } from '../src/billing/billing-signature';
import { BillingProviderEventDto } from '../src/billing/dto/billing.dto';
import { PrismaService } from '../src/prisma/prisma.service';

const WEBHOOK_SECRET = 'knowme-test-billing-secret-2026';

describe('KnowMe authoritative billing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.BILLING_WEBHOOK_SECRET_TEST = WEBHOOK_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
    await prisma.billingEvent.deleteMany();
  });

  afterAll(async () => {
    delete process.env.BILLING_WEBHOOK_SECRET_TEST;
    await app.close();
  });

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@billing.knowme.test`,
        username: `billing_${index}`,
        displayName: `Billing ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  async function login(identifier: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier, password: 'KnowMeTest123!' })
      .expect(201);
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function signedEvent(body: BillingProviderEventDto) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    return request(app.getHttpServer())
      .post('/billing/webhooks/test')
      .set('x-billing-timestamp', timestamp)
      .set('x-billing-signature', signBillingPayload(WEBHOOK_SECRET, timestamp, body))
      .send(body);
  }

  it('grants, preserves, renews and revokes Premium only from verified events', async () => {
    const member = await register('member');
    const attacker = await register('attacker');
    const adminRegistration = await register('admin');
    const memberId = member.body.user.id as string;
    const memberToken = member.body.accessToken as string;
    const attackerToken = attacker.body.accessToken as string;

    await prisma.user.update({
      where: { id: adminRegistration.body.user.id },
      data: { role: 'ADMIN' }
    });
    const admin = await login('billing_admin');
    const adminToken = admin.body.accessToken as string;

    const catalog = await request(app.getHttpServer())
      .get('/billing/plans?platform=WEB&currency=USD')
      .expect(200);
    expect(catalog.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'premium_monthly',
          checkoutAvailable: false,
          entitlements: expect.arrayContaining(['premium.core', 'premium.themes']),
          prices: expect.arrayContaining([
            expect.objectContaining({ currency: 'USD', unitAmount: 2000 })
          ])
        })
      ])
    );

    const initial = await request(app.getHttpServer())
      .get('/billing/me')
      .set(auth(memberToken))
      .expect(200);
    expect(initial.body.subscriptions).toEqual([]);
    expect(initial.body.entitlements).toEqual([]);

    await request(app.getHttpServer())
      .post('/billing/webhooks/test')
      .send({ premium: true, accountId: memberId })
      .expect(401);

    await request(app.getHttpServer())
      .get('/admin/billing/plans')
      .set(auth(attackerToken))
      .set('x-role', 'ADMIN')
      .set('x-permissions', 'billing.manage')
      .expect(403);

    const base = Date.now() - 60 * 60 * 1000;
    const start = new Date(base);
    const end = new Date(base + 30 * 24 * 60 * 60 * 1000);
    const subscriptionId = 'sub_member_premium_001';

    const activeEvent: BillingProviderEventDto = {
      eventId: 'evt_active_001',
      type: 'SUBSCRIPTION_ACTIVATED',
      occurredAt: new Date(base + 1000).toISOString(),
      accountId: memberId,
      planKey: 'premium_monthly',
      externalSubscriptionId: subscriptionId,
      status: 'ACTIVE',
      currentPeriodStart: start.toISOString(),
      currentPeriodEnd: end.toISOString(),
      cancelAtPeriodEnd: false,
      metadata: { environment: 'test' }
    };

    const activated = await signedEvent(activeEvent).expect(201);
    expect(activated.body).toEqual(
      expect.objectContaining({
        replayed: false,
        event: expect.objectContaining({ status: 'PROCESSED' }),
        subscription: expect.objectContaining({
          status: 'ACTIVE',
          externalSubscriptionId: subscriptionId
        })
      })
    );

    const activeState = await request(app.getHttpServer())
      .get('/billing/me')
      .set(auth(memberToken))
      .expect(200);
    expect(activeState.body.subscriptions[0]).toEqual(
      expect.objectContaining({ status: 'ACTIVE', grantsAccess: true })
    );
    expect(activeState.body.entitlements).toHaveLength(9);

    await request(app.getHttpServer())
      .get('/exclusive/premium-insights')
      .set(auth(memberToken))
      .expect(200);

    const replay = await signedEvent(activeEvent).expect(201);
    expect(replay.body.replayed).toBe(true);
    expect(
      await prisma.billingEvent.count({
        where: { provider: 'TEST', externalEventId: activeEvent.eventId }
      })
    ).toBe(1);
    expect(
      await prisma.entitlementGrant.count({
        where: {
          userId: memberId,
          source: 'SUBSCRIPTION',
          revokedAt: null
        }
      })
    ).toBe(9);

    const conflictingReplay = { ...activeEvent, status: 'REFUNDED' as const };
    await signedEvent(conflictingReplay).expect(409);

    const olderEvent: BillingProviderEventDto = {
      ...activeEvent,
      eventId: 'evt_old_expired_001',
      type: 'SUBSCRIPTION_EXPIRED',
      occurredAt: new Date(base).toISOString(),
      status: 'EXPIRED',
      endedAt: new Date(base).toISOString()
    };
    const ignored = await signedEvent(olderEvent).expect(201);
    expect(ignored.body.event).toEqual(
      expect.objectContaining({ status: 'IGNORED', reason: 'OUT_OF_ORDER' })
    );

    await request(app.getHttpServer())
      .get('/exclusive/premium-insights')
      .set(auth(memberToken))
      .expect(200);

    const cancelEvent: BillingProviderEventDto = {
      ...activeEvent,
      eventId: 'evt_cancel_scheduled_001',
      type: 'SUBSCRIPTION_CANCEL_SCHEDULED',
      occurredAt: new Date(base + 2 * 60 * 60 * 1000).toISOString(),
      status: 'ACTIVE',
      cancelAtPeriodEnd: true
    };
    const scheduled = await signedEvent(cancelEvent).expect(201);
    expect(scheduled.body.subscription.cancelAtPeriodEnd).toBe(true);

    await request(app.getHttpServer())
      .get('/exclusive/premium-insights')
      .set(auth(memberToken))
      .expect(200);

    const renewedEnd = new Date(end.getTime() + 30 * 24 * 60 * 60 * 1000);
    const renewalEvent: BillingProviderEventDto = {
      ...activeEvent,
      eventId: 'evt_renewed_001',
      type: 'SUBSCRIPTION_RENEWED',
      occurredAt: new Date(base + 3 * 60 * 60 * 1000).toISOString(),
      currentPeriodStart: end.toISOString(),
      currentPeriodEnd: renewedEnd.toISOString(),
      cancelAtPeriodEnd: false
    };
    const renewed = await signedEvent(renewalEvent).expect(201);
    expect(renewed.body.subscription.currentPeriodEnd).toBe(renewedEnd.toISOString());

    const renewedGrants = await prisma.entitlementGrant.findMany({
      where: {
        userId: memberId,
        source: 'SUBSCRIPTION',
        externalReference: renewed.body.subscription.id,
        revokedAt: null
      }
    });
    expect(renewedGrants).toHaveLength(9);
    expect(renewedGrants.every((grant) => grant.expiresAt?.getTime() === renewedEnd.getTime())).toBe(true);
    expect(renewedGrants.every((grant) => grant.startsAt <= new Date())).toBe(true);

    const expiredEvent: BillingProviderEventDto = {
      ...renewalEvent,
      eventId: 'evt_expired_001',
      type: 'SUBSCRIPTION_EXPIRED',
      occurredAt: new Date(base + 4 * 60 * 60 * 1000).toISOString(),
      status: 'EXPIRED',
      endedAt: new Date(base + 4 * 60 * 60 * 1000).toISOString()
    };
    await signedEvent(expiredEvent).expect(201);

    await request(app.getHttpServer())
      .get('/exclusive/premium-insights')
      .set(auth(memberToken))
      .expect(403);

    const afterExpiry = await request(app.getHttpServer())
      .get('/billing/me')
      .set(auth(memberToken))
      .expect(200);
    expect(afterExpiry.body.subscriptions[0].grantsAccess).toBe(false);
    expect(afterExpiry.body.entitlements).toEqual([]);

    const reactivationStart = new Date(base + 5 * 60 * 60 * 1000);
    const reactivationEnd = new Date(reactivationStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    const reactivationEvent: BillingProviderEventDto = {
      ...activeEvent,
      eventId: 'evt_reactivated_001',
      type: 'SUBSCRIPTION_REACTIVATED',
      occurredAt: reactivationStart.toISOString(),
      currentPeriodStart: reactivationStart.toISOString(),
      currentPeriodEnd: reactivationEnd.toISOString(),
      status: 'ACTIVE'
    };
    await signedEvent(reactivationEvent).expect(201);

    await request(app.getHttpServer())
      .get('/exclusive/premium-insights')
      .set(auth(memberToken))
      .expect(200);

    const refundEvent: BillingProviderEventDto = {
      ...reactivationEvent,
      eventId: 'evt_refunded_001',
      type: 'SUBSCRIPTION_REFUNDED',
      occurredAt: new Date(base + 6 * 60 * 60 * 1000).toISOString(),
      status: 'REFUNDED',
      endedAt: new Date(base + 6 * 60 * 60 * 1000).toISOString()
    };
    await signedEvent(refundEvent).expect(201);

    await request(app.getHttpServer())
      .get('/exclusive/premium-insights')
      .set(auth(memberToken))
      .expect(403);

    const adminPlans = await request(app.getHttpServer())
      .get('/admin/billing/plans')
      .set(auth(adminToken))
      .expect(200);
    expect(adminPlans.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'premium_monthly' })])
    );

    const adminEvents = await request(app.getHttpServer())
      .get('/admin/billing/events?provider=TEST')
      .set(auth(adminToken))
      .expect(200);
    expect(adminEvents.body).toHaveLength(7);
    expect(adminEvents.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalEventId: 'evt_old_expired_001', status: 'IGNORED' }),
        expect.objectContaining({ externalEventId: 'evt_refunded_001', status: 'PROCESSED' })
      ])
    );

    const [subscription, activeGrants, totalGrants, auditCount] = await Promise.all([
      prisma.billingSubscription.findUnique({
        where: {
          provider_externalSubscriptionId: {
            provider: 'TEST',
            externalSubscriptionId: subscriptionId
          }
        }
      }),
      prisma.entitlementGrant.count({
        where: { userId: memberId, source: 'SUBSCRIPTION', revokedAt: null }
      }),
      prisma.entitlementGrant.count({
        where: { userId: memberId, source: 'SUBSCRIPTION' }
      }),
      prisma.auditLog.count({
        where: { targetAccountId: memberId, action: { startsWith: 'BILLING_EVENT_' } }
      })
    ]);

    expect(subscription?.status).toBe('REFUNDED');
    expect(activeGrants).toBe(0);
    expect(totalGrants).toBe(18);
    expect(auditCount).toBe(7);
  });
});

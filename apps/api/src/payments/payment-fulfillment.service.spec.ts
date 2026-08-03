import { PaymentFulfillmentService } from './payment-fulfillment.service';

describe('PaymentFulfillmentService', () => {
  it('does not extend an existing subscription twice for the same provider transaction', async () => {
    const fulfilledAt = new Date('2026-08-01T00:00:00.000Z');
    const order = {
      id: 'order-1',
      userId: 'user-1',
      provider: 'APPLE_APP_STORE',
      reference: 'KM-APL-ONE',
      expectedAmount: 2000,
      currency: 'USD',
      fulfilledAt,
      product: {
        key: 'premium_monthly',
        fulfillmentType: 'BILLING_PLAN',
        fulfillmentReference: 'premium_monthly',
        requiresVerification: false,
        metadata: { interval: 'MONTH', intervalCount: 1 }
      },
      price: { externalProductId: 'knowme.premium.monthly' },
      invoice: null
    };
    const existingSubscription = {
      id: 'subscription-1',
      latestExternalEventId: 'apple-transaction-1'
    };
    const tx = {
      paymentOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(order)
      },
      billingPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'plan-1',
          key: 'premium_monthly',
          entitlements: [{ key: 'premium.core' }]
        })
      },
      billingSubscription: {
        findUnique: jest.fn().mockResolvedValue(existingSubscription),
        upsert: jest.fn()
      },
      entitlementGrant: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn()
      },
      auditLog: { create: jest.fn() }
    };
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue(order)
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx)
      )
    };
    const service = new PaymentFulfillmentService(
      prisma as never,
      {} as never,
      { record: jest.fn() } as never
    );

    const result = await service.fulfill('order-1', {
      status: 'SUCCESS',
      externalTransactionId: 'apple-transaction-1',
      externalSubscriptionId: 'apple-original-transaction',
      externalProductId: 'knowme.premium.monthly',
      purchasedAt: new Date('2026-08-01T00:00:00.000Z'),
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-01T00:00:00.000Z'),
      rawStatus: 'ACTIVE',
      raw: {}
    });

    expect(result).toEqual(
      expect.objectContaining({
        replayed: true,
        renewed: false,
        subscription: existingSubscription
      })
    );
    expect(tx.billingSubscription.upsert).not.toHaveBeenCalled();
    expect(tx.entitlementGrant.findMany).not.toHaveBeenCalled();
  });
});

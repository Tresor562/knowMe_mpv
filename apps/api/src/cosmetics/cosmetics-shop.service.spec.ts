import { CosmeticsShopService } from './cosmetics-shop.service';

describe('CosmeticsShopService', () => {
  const service = new CosmeticsShopService({} as never, {} as never, {} as never);

  it('keeps purchases atomic, idempotent and visual-only', () => {
    expect(service.policy()).toEqual(
      expect.objectContaining({
        currency: 'KNOWCOINS',
        verifiedLedgerRequired: true,
        atomicDebitAndOwnership: true,
        idempotentPurchases: true,
        onePurchasePerItemPerAccount: true,
        visualOnly: true,
        gameplayEffectsAllowed: false,
        paidPriorityAllowed: false,
        socialVisibilityBoostAllowed: false,
        premiumBypassAllowed: false
      })
    );
  });

  it('checks offer windows deterministically', () => {
    const now = new Date('2026-08-02T12:00:00.000Z');
    expect(
      service.isAvailable(
        {
          active: true,
          startsAt: new Date('2026-08-02T00:00:00.000Z'),
          endsAt: new Date('2026-08-03T00:00:00.000Z')
        },
        now
      )
    ).toBe(true);
    expect(
      service.isAvailable(
        {
          active: true,
          startsAt: new Date('2026-08-03T00:00:00.000Z'),
          endsAt: null
        },
        now
      )
    ).toBe(false);
    expect(
      service.isAvailable(
        {
          active: true,
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: new Date('2026-08-02T12:00:00.000Z')
        },
        now
      )
    ).toBe(false);
  });
});

import { CosmeticsShopService } from './cosmetics-shop.service';

describe('CosmeticsShopService', () => {
  const service = new CosmeticsShopService({} as never, {} as never, {} as never);

  it('keeps purchases atomic, idempotent, server-authoritative and visual-only', () => {
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
        premiumBypassAllowed: false,
        premiumEntitlementKey: 'premium.core',
        serverAuthoritativePricing: true,
        serverAuthoritativeAcquisition: true
      })
    );
  });

  it('derives PREMIUM_KNOWCOINS eligibility from the live server entitlement', async () => {
    const now = new Date('2026-09-23T02:00:00.000Z');
    const premiumOffer = {
      id: 'offer-premium',
      key: 'hero-jacket',
      version: 1,
      itemId: 'item-premium',
      priceKnowCoins: 250,
      active: true,
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: null,
      item: { id: 'item-premium', acquisitionMode: 'PREMIUM_KNOWCOINS' }
    };
    const entitlementGrant = { findFirst: jest.fn().mockResolvedValue(null) };
    const prisma = {
      cosmeticOfferDefinition: { findMany: jest.fn().mockResolvedValue([premiumOffer]) },
      cosmeticOwnership: { findMany: jest.fn().mockResolvedValue([]) },
      entitlementGrant
    };
    const wallet = { me: jest.fn().mockResolvedValue({ balance: 10_000 }) };
    const premiumService = new CosmeticsShopService(prisma as never, wallet as never, {} as never);

    const withoutPremium = await premiumService.shop('user-1', now);
    expect(entitlementGrant.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        key: 'premium.core',
        startsAt: { lte: now },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      select: { id: true }
    });
    expect(withoutPremium.premium).toBe(false);
    expect(withoutPremium.offers[0]).toEqual(expect.objectContaining({ premiumEligible: false, affordable: false }));

    entitlementGrant.findFirst.mockResolvedValueOnce({ id: 'grant-1' });
    const withPremium = await premiumService.shop('user-1', now);
    expect(withPremium.premium).toBe(true);
    expect(withPremium.offers[0]).toEqual(expect.objectContaining({ premiumEligible: true, affordable: true }));
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

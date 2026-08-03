import {
  GiftDefinition,
  GiftInstance,
  GiftListing,
  assertGiftCanBeListed,
  assertGiftPurchaseAllowed,
  calculateGiftEstimatedValue,
  calculateGiftResaleSettlement,
  calculateGiftUpgradePrice,
  deriveTransferableAt,
  giftExchangePolicy
} from './gift-exchange.domain';

const definition: GiftDefinition = {
  key: 'cosmic-heart',
  name: 'Cœur Cosmique',
  basePriceKnowCoins: 1_000,
  rarity: 'EPIC',
  limitedSupply: 10_000,
  upgradeable: true,
  upgradeCostKnowCoins: 400,
  transferable: true,
  resaleAllowed: true,
  craftable: true,
  premiumLaunchOnly: false,
  creatorRoyaltyBps: 250,
  marketplaceFeeBps: 500,
  active: true
};

function instance(overrides: Partial<GiftInstance> = {}): GiftInstance {
  return {
    id: 'gift-instance-1',
    definitionKey: definition.key,
    ownerId: 'seller-1',
    serialNumber: 77,
    editionSize: 10_000,
    collectible: true,
    traits: [
      { category: 'MODEL', key: 'crystal', rarityWeight: 12 },
      { category: 'EFFECT', key: 'cosmic-pulse', rarityWeight: 8 }
    ],
    state: 'OWNED',
    acquiredAt: new Date('2026-08-01T10:00:00.000Z'),
    transferableAt: new Date('2026-08-01T11:00:00.000Z'),
    listedAt: null,
    lastSalePriceKnowCoins: null,
    provenanceHash: 'sha256:gift-instance-1',
    ...overrides
  };
}

describe('gift exchange domain', () => {
  it('splits resale value between seller, treasury and creator', () => {
    expect(calculateGiftResaleSettlement(10_000, 500, 250)).toEqual({
      buyerDebitKnowCoins: 10_000,
      sellerCreditKnowCoins: 9_250,
      treasuryFeeKnowCoins: 500,
      creatorRoyaltyKnowCoins: 250
    });
  });

  it('allows only the owner to list a transferable gift after cooldown', () => {
    expect(() =>
      assertGiftCanBeListed(instance(), 3_000, definition, {
        actorId: 'seller-1',
        ownerId: 'seller-1',
        now: new Date('2026-08-02T10:00:00.000Z'),
        minimumPriceKnowCoins: 100,
        maximumPriceKnowCoins: 100_000,
        accountSuspended: false,
        marketplaceBlocked: false
      })
    ).not.toThrow();

    expect(() =>
      assertGiftCanBeListed(instance(), 3_000, definition, {
        actorId: 'attacker-1',
        ownerId: 'seller-1',
        now: new Date('2026-08-02T10:00:00.000Z'),
        minimumPriceKnowCoins: 100,
        maximumPriceKnowCoins: 100_000,
        accountSuspended: false,
        marketplaceBlocked: false
      })
    ).toThrow('propriétaire');
  });

  it('rejects self-purchases and insufficient balances', () => {
    const listing: GiftListing = {
      id: 'listing-1',
      giftInstanceId: 'gift-instance-1',
      sellerId: 'seller-1',
      priceKnowCoins: 3_000,
      createdAt: new Date('2026-08-02T10:00:00.000Z'),
      expiresAt: null,
      active: true
    };

    expect(() =>
      assertGiftPurchaseAllowed(
        listing,
        'seller-1',
        'seller-1',
        100_000,
        new Date('2026-08-02T12:00:00.000Z')
      )
    ).toThrow('propre cadeau');

    expect(() =>
      assertGiftPurchaseAllowed(
        listing,
        'buyer-1',
        'seller-1',
        100,
        new Date('2026-08-02T12:00:00.000Z')
      )
    ).toThrow('Solde KnowCoins insuffisant');
  });

  it('supports paid upgrades to collectible gifts', () => {
    expect(calculateGiftUpgradePrice(definition)).toBe(400);
  });

  it('values collectible, low-serial and rare-trait gifts above base price', () => {
    expect(calculateGiftEstimatedValue(definition, instance(), 1.2)).toBeGreaterThan(
      definition.basePriceKnowCoins
    );
  });

  it('enforces a minimum transfer cooldown', () => {
    const now = new Date('2026-08-02T10:00:00.000Z');
    expect(deriveTransferableAt(now).getTime()).toBeGreaterThan(now.getTime());
    expect(() => deriveTransferableAt(now, 1)).toThrow('Délai de transfert insuffisant');
  });

  it('publishes a marketplace policy richer than the former visual-only gifts', () => {
    expect(giftExchangePolicy()).toMatchObject({
      upgradeToCollectibleSupported: true,
      transfersSupported: true,
      resaleMarketplaceSupported: true,
      directOffersSupported: true,
      selfPurchaseAllowed: false,
      washTradingDetectionRequired: true,
      blockchainExportEnabledAtLaunch: false,
      KnowCoinsOnlyAtLaunch: true
    });
  });
});

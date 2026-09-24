import { BadRequestException } from '@nestjs/common';
import { CosmeticsShopService } from './cosmetics-shop.service';

const validHairManifest = {
  manifestVersion: 1,
  assetKey: 'knowme.hair.shop-spec.v1',
  kind: 'HAIR',
  slot: 'AVATAR_HAIR',
  format: 'GLB',
  materialProfileKey: 'knowme.hair.pbr.v1',
  morphTargets: [],
  lods: [
    { level: 0, uri: 'asset://runtime/avatar/hair/shop-spec-lod0.glb', triangles: 24000, vertices: 13000, downloadBytes: 2_000_000 },
    { level: 1, uri: 'asset://runtime/avatar/hair/shop-spec-lod1.glb', triangles: 15000, vertices: 8000, downloadBytes: 1_200_000 },
    { level: 2, uri: 'asset://runtime/avatar/hair/shop-spec-lod2.glb', triangles: 7000, vertices: 3500, downloadBytes: 600_000 }
  ],
  textures: {
    baseColor: 'asset://runtime/avatar/textures/hair-shop-base.ktx2',
    normal: 'asset://runtime/avatar/textures/hair-shop-normal.ktx2',
    maxResolution: 2048
  },
  geometry: { skinned: false, hairCards: true },
  pbr: true,
  originalDesign: true
};

describe('CosmeticsShopService', () => {
  const service = new CosmeticsShopService({} as never, {} as never, {} as never);

  it('keeps purchases atomic, idempotent, server-authoritative and visual-only', () => {
    expect(service.policy()).toEqual(
      expect.objectContaining({
        currency: 'KNOWCOINS', verifiedLedgerRequired: true, atomicDebitAndOwnership: true,
        idempotentPurchases: true, onePurchasePerItemPerAccount: true, visualOnly: true,
        gameplayEffectsAllowed: false, paidPriorityAllowed: false, socialVisibilityBoostAllowed: false,
        premiumBypassAllowed: false, premiumEntitlementKey: 'premium.core', serverAuthoritativePricing: true,
        serverAuthoritativeAcquisition: true, validated3DAssetsRequired: true
      })
    );
  });

  it('derives PREMIUM_KNOWCOINS eligibility from the live server entitlement', async () => {
    const now = new Date('2026-09-23T02:00:00.000Z');
    const premiumOffer = { id: 'offer-premium', key: 'hero-jacket', version: 1, itemId: 'item-premium', priceKnowCoins: 250, active: true, startsAt: new Date('2026-09-01T00:00:00.000Z'), endsAt: null, item: { id: 'item-premium', acquisitionMode: 'PREMIUM_KNOWCOINS' } };
    const entitlementGrant = { findFirst: jest.fn().mockResolvedValue(null) };
    const prisma = { cosmeticOfferDefinition: { findMany: jest.fn().mockResolvedValue([premiumOffer]) }, cosmeticOwnership: { findMany: jest.fn().mockResolvedValue([]) }, entitlementGrant };
    const wallet = { me: jest.fn().mockResolvedValue({ balance: 10_000 }) };
    const premiumService = new CosmeticsShopService(prisma as never, wallet as never, {} as never);
    const withoutPremium = await premiumService.shop('user-1', now);
    expect(entitlementGrant.findFirst).toHaveBeenCalledWith({ where: { userId: 'user-1', key: 'premium.core', startsAt: { lte: now }, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { id: true } });
    expect(withoutPremium.premium).toBe(false);
    expect(withoutPremium.offers[0]).toEqual(expect.objectContaining({ premiumEligible: false, affordable: false }));
    entitlementGrant.findFirst.mockResolvedValueOnce({ id: 'grant-1' });
    const withPremium = await premiumService.shop('user-1', now);
    expect(withPremium.premium).toBe(true);
    expect(withPremium.offers[0]).toEqual(expect.objectContaining({ premiumEligible: true, affordable: true }));
  });

  it('hides uncertified canonical avatar offers while keeping certified runtime assets', async () => {
    const now = new Date('2026-09-23T07:00:00.000Z');
    const offerBase = { version: 1, priceKnowCoins: 100, active: true, startsAt: new Date('2026-09-01T00:00:00.000Z'), endsAt: null };
    const uncertified = { ...offerBase, id: 'offer-bad', key: 'hair-bad', itemId: 'item-bad', item: { id: 'item-bad', slot: 'AVATAR_HAIR', acquisitionMode: 'KNOWCOINS', assetUrl: validHairManifest.lods[0].uri, avatarAssetManifest: null, assetValidatedAt: null } };
    const certified = { ...offerBase, id: 'offer-good', key: 'hair-good', itemId: 'item-good', item: { id: 'item-good', slot: 'AVATAR_HAIR', acquisitionMode: 'KNOWCOINS', assetUrl: validHairManifest.lods[0].uri, avatarAssetManifest: validHairManifest, assetValidatedAt: now } };
    const prisma = { cosmeticOfferDefinition: { findMany: jest.fn().mockResolvedValue([uncertified, certified]) }, cosmeticOwnership: { findMany: jest.fn().mockResolvedValue([]) }, entitlementGrant: { findFirst: jest.fn().mockResolvedValue(null) } };
    const runtimeService = new CosmeticsShopService(prisma as never, { me: jest.fn().mockResolvedValue({ balance: 500 }) } as never, {} as never);
    const result = await runtimeService.shop('user-1', now);
    expect(result.offers.map((offer) => offer.id)).toEqual(['offer-good']);
  });

  it('refuses publishing a shop offer for an uncertified canonical avatar asset', async () => {
    const prisma = { cosmeticItemDefinition: { findUnique: jest.fn().mockResolvedValue({ id: 'item-hair', slot: 'AVATAR_HAIR', acquisitionMode: 'KNOWCOINS', active: true, startsAt: new Date('2026-09-01T00:00:00.000Z'), endsAt: null, assetUrl: validHairManifest.lods[0].uri, avatarAssetManifest: null, assetValidatedAt: null }) } };
    const runtimeService = new CosmeticsShopService(prisma as never, {} as never, {} as never);
    await expect(runtimeService.createOffer('admin-1', { key: 'hair-offer', version: 1, itemId: 'item-hair', priceKnowCoins: 100, active: false, reason: 'test runtime authority' } as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checks offer windows deterministically', () => {
    const now = new Date('2026-08-02T12:00:00.000Z');
    expect(service.isAvailable({ active: true, startsAt: new Date('2026-08-02T00:00:00.000Z'), endsAt: new Date('2026-08-03T00:00:00.000Z') }, now)).toBe(true);
    expect(service.isAvailable({ active: true, startsAt: new Date('2026-08-03T00:00:00.000Z'), endsAt: null }, now)).toBe(false);
    expect(service.isAvailable({ active: true, startsAt: new Date('2026-08-01T00:00:00.000Z'), endsAt: new Date('2026-08-02T12:00:00.000Z') }, now)).toBe(false);
  });
});

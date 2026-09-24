import { BadRequestException } from '@nestjs/common';
import { CosmeticsShopService } from './cosmetics-shop.service';

const now = new Date('2026-09-24T02:30:00.000Z');
const hairManifest = {
  manifestVersion: 1,
  assetKey: 'knowme.hair.hero.v1',
  kind: 'HAIR',
  slot: 'AVATAR_HAIR',
  format: 'GLB',
  materialProfileKey: 'knowme.hair.pbr.v1',
  morphTargets: [],
  lods: [
    { level: 0, uri: 'asset://runtime/avatar/hair/hero-lod0.glb', triangles: 24000, vertices: 13000, downloadBytes: 2_000_000 },
    { level: 1, uri: 'asset://runtime/avatar/hair/hero-lod1.glb', triangles: 15000, vertices: 8000, downloadBytes: 1_200_000 },
    { level: 2, uri: 'asset://runtime/avatar/hair/hero-lod2.glb', triangles: 7000, vertices: 3500, downloadBytes: 600_000 }
  ],
  textures: { baseColor: 'asset://runtime/avatar/textures/hair-base.ktx2', normal: 'asset://runtime/avatar/textures/hair-normal.ktx2', maxResolution: 2048 },
  geometry: { skinned: false, hairCards: true },
  pbr: true,
  originalDesign: true
};

function serviceFor(item: Record<string, unknown>) {
  const offer = { id: 'offer-1', key: 'hero-hair', version: 1, itemId: 'item-1', priceKnowCoins: 100, active: true, startsAt: new Date('2026-09-01T00:00:00.000Z'), endsAt: null, item: { id: 'item-1', acquisitionMode: 'KNOWCOINS', ...item } };
  const prisma = {
    cosmeticOfferDefinition: { findMany: jest.fn().mockResolvedValue([offer]) },
    cosmeticOwnership: { findMany: jest.fn().mockResolvedValue([]) },
    entitlementGrant: { findFirst: jest.fn().mockResolvedValue(null) },
    cosmeticItemDefinition: { findUnique: jest.fn().mockResolvedValue(offer.item) }
  };
  return new CosmeticsShopService(prisma as never, { me: jest.fn().mockResolvedValue({ balance: 1000 }) } as never, {} as never);
}

describe('Cosmetics shop persisted avatar runtime authority', () => {
  it('accepts a persisted avatar only when the complete manifest still validates and assetUrl is its LOD0', async () => {
    const service = serviceFor({ slot: 'AVATAR_HAIR', assetUrl: hairManifest.lods[0].uri, avatarAssetManifest: hairManifest, assetValidatedAt: now });
    const result = await service.shop('user-1', now);
    expect(result.offers).toHaveLength(1);
  });

  it('hides a persisted avatar whose manifest was mutated after certification', async () => {
    const tampered = { ...hairManifest, geometry: { ...hairManifest.geometry, hairCards: false } };
    const service = serviceFor({ slot: 'AVATAR_HAIR', assetUrl: hairManifest.lods[0].uri, avatarAssetManifest: tampered, assetValidatedAt: now });
    const result = await service.shop('user-1', now);
    expect(result.offers).toHaveLength(0);
  });

  it('hides a persisted avatar when assetUrl no longer matches the certified LOD0', async () => {
    const service = serviceFor({ slot: 'AVATAR_HAIR', assetUrl: 'https://evil.invalid/replaced.glb', avatarAssetManifest: hairManifest, assetValidatedAt: now });
    const result = await service.shop('user-1', now);
    expect(result.offers).toHaveLength(0);
  });

  it('refuses offer publication for a tampered persisted avatar even when assetValidatedAt is present', async () => {
    const tampered = { ...hairManifest, premiumUnlocked: true };
    const service = serviceFor({ slot: 'AVATAR_HAIR', assetUrl: hairManifest.lods[0].uri, avatarAssetManifest: tampered, assetValidatedAt: now, active: true, startsAt: new Date('2026-09-01T00:00:00.000Z'), endsAt: null });
    await expect(service.createOffer('admin-1', { key: 'hero-hair-offer', version: 1, itemId: 'item-1', priceKnowCoins: 100, active: false, reason: 'runtime authority test' } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});

import { CosmeticPresetsService } from './cosmetic-presets.service';

const now = new Date('2026-09-24T08:30:00.000Z');
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
  textures: {
    baseColor: 'asset://runtime/avatar/textures/hair-base.ktx2',
    normal: 'asset://runtime/avatar/textures/hair-normal.ktx2',
    maxResolution: 2048
  },
  geometry: { skinned: false, hairCards: true },
  pbr: true,
  originalDesign: true
};

function service() {
  return new CosmeticPresetsService({} as never, {} as never);
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    slot: 'AVATAR_HAIR',
    assetUrl: hairManifest.lods[0].uri,
    avatarAssetManifest: hairManifest,
    assetValidatedAt: now,
    active: true,
    startsAt: new Date('2026-09-01T00:00:00.000Z'),
    endsAt: null,
    ...overrides
  };
}

describe('Cosmetic preset avatar runtime authority', () => {
  const ready = (value: Record<string, unknown>) =>
    (service() as unknown as { isRuntimeAssetReady(item: Record<string, unknown>): boolean }).isRuntimeAssetReady(value);

  it('accepts a fully certified persisted avatar asset', () => {
    expect(ready(candidate())).toBe(true);
  });

  it('rejects a manifest tampered after certification', () => {
    const tampered = {
      ...hairManifest,
      geometry: { ...hairManifest.geometry, hairCards: false }
    };
    expect(ready(candidate({ avatarAssetManifest: tampered }))).toBe(false);
  });

  it('rejects an assetUrl that no longer identifies certified LOD0', () => {
    expect(ready(candidate({ assetUrl: 'https://evil.invalid/replaced.glb' }))).toBe(false);
  });

  it('rejects authority metadata injected into the artistic manifest', () => {
    expect(ready(candidate({ avatarAssetManifest: { ...hairManifest, premiumUnlocked: true } }))).toBe(false);
  });

  it('rejects avatar assets with missing certification evidence', () => {
    expect(ready(candidate({ assetValidatedAt: null }))).toBe(false);
    expect(ready(candidate({ avatarAssetManifest: null }))).toBe(false);
  });

  it('does not impose avatar runtime certification on legacy non-avatar slots', () => {
    expect(ready(candidate({ slot: 'BADGE', avatarAssetManifest: null, assetValidatedAt: null }))).toBe(true);
  });
});

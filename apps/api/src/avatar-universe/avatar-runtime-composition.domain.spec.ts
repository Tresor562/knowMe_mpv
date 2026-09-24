import { AVATAR_BODY_MORPHS, AVATAR_FACE_MORPHS } from './avatar-asset-manifest.domain';
import { AVATAR_DNA_DEFAULT_KEYS, AVATAR_DNA_SCHEMA_VERSION } from './avatar-dna.domain';
import { AVATAR_BALANCED_RENDER_PROFILE } from './avatar-render-profile.domain';
import { validateAvatarRuntimeComposition } from './avatar-runtime-composition.domain';
import { AVATAR_DEFAULT_MORPHOLOGY, AVATAR_DEFAULT_PERSONALITY } from './avatar-universe.domain';

const lods = (prefix: string, triangles = 30000) => [
  { level: 0 as const, uri: `asset://runtime/avatar/${prefix}-lod0.glb`, triangles, vertices: Math.ceil(triangles / 2), downloadBytes: 3_000_000 },
  { level: 1 as const, uri: `asset://runtime/avatar/${prefix}-lod1.glb`, triangles: Math.floor(triangles * .7), vertices: Math.floor(Math.ceil(triangles / 2) * .7), downloadBytes: 1_500_000 },
  { level: 2 as const, uri: `asset://runtime/avatar/${prefix}-lod2.glb`, triangles: Math.floor(triangles * .3), vertices: Math.floor(Math.ceil(triangles / 2) * .3), downloadBytes: 700_000 }
];
const dna = {
  schemaVersion: AVATAR_DNA_SCHEMA_VERSION, revision: 1,
  morphology: AVATAR_DEFAULT_MORPHOLOGY, personality: AVATAR_DEFAULT_PERSONALITY,
  renderTier: 'REALTIME_3D_BALANCED' as const, ...AVATAR_DNA_DEFAULT_KEYS
};
const baseBody = {
  manifestVersion: 1 as const, assetKey: 'knowme.body.hero.v1', kind: 'BASE_BODY' as const, format: 'GLB' as const,
  skeletonKey: 'knowme.humanoid.v1', materialProfileKey: 'knowme-pbr-skin-v1',
  morphTargets: [...AVATAR_BODY_MORPHS, ...AVATAR_FACE_MORPHS], lods: lods('body', 30000),
  textures: { baseColor: 'asset://runtime/avatar/body-base.ktx2', normal: 'asset://runtime/avatar/body-normal.ktx2', maxResolution: 2048 as const },
  geometry: { skinned: true, maxBonesPerVertex: 4 as const }, pbr: true as const, originalDesign: true as const
};
const clothing = {
  manifestVersion: 1 as const, assetKey: 'knowme.outfit.hero.v1', kind: 'CLOTHING' as const, slot: 'AVATAR_OUTFIT' as const, format: 'GLB' as const,
  skeletonKey: 'knowme.humanoid.v1', materialProfileKey: 'knowme-pbr-cloth-v1', morphTargets: [...AVATAR_BODY_MORPHS], lods: lods('outfit', 28000),
  textures: { baseColor: 'asset://runtime/avatar/outfit-base.ktx2', normal: 'asset://runtime/avatar/outfit-normal.ktx2', metallicRoughness: 'asset://runtime/avatar/outfit-mr.ktx2', maxResolution: 2048 as const },
  geometry: { skinned: true, maxBonesPerVertex: 4 as const }, pbr: true as const, originalDesign: true as const
};
const hair = {
  manifestVersion: 1 as const, assetKey: 'knowme.hair.hero.v1', kind: 'HAIR' as const, slot: 'AVATAR_HAIR' as const, format: 'GLB' as const,
  materialProfileKey: 'knowme-pbr-hair-v1', morphTargets: [], lods: lods('hair', 16000),
  textures: { baseColor: 'asset://runtime/avatar/hair-base.ktx2', normal: 'asset://runtime/avatar/hair-normal.ktx2', maxResolution: 2048 as const },
  geometry: { skinned: false, hairCards: true }, pbr: true as const, originalDesign: true as const
};

const composition = (overrides: Record<string, unknown> = {}) => ({ dna, renderProfile: AVATAR_BALANCED_RENDER_PROFILE, baseBody, equipped: [clothing, hair], ...overrides });

describe('assembled avatar runtime certification', () => {
  it('certifies a compatible mobile-ready composition and reports aggregate metrics', () => {
    const result = validateAvatarRuntimeComposition(composition());
    expect(result.metrics.visibleTriangles).toBe(74000);
    expect(result.metrics.skinnedMeshes).toBe(2);
    expect(result.metrics.lodLevel).toBe(0);
  });

  it('rejects a render profile whose tier does not match Avatar DNA', () => {
    expect(() => validateAvatarRuntimeComposition(composition({ renderProfile: { ...AVATAR_BALANCED_RENDER_PROFILE, tier: 'REALTIME_3D_HIGH' } } as never))).toThrow(/render tier/i);
  });

  it('rejects duplicate equipped Cosmetics slots', () => {
    expect(() => validateAvatarRuntimeComposition(composition({ equipped: [clothing, { ...clothing, assetKey: 'knowme.outfit.second.v1', lods: lods('outfit-second', 20000) }] }) as never)).toThrow(/multiple assets for slot/i);
  });

  it('rejects a forged skeleton before the renderer can consume it', () => {
    expect(() => validateAvatarRuntimeComposition(composition({ equipped: [{ ...clothing, skeletonKey: 'evil.skeleton.v1' }] }) as never)).toThrow(/runtime-certified|skeleton/i);
  });

  it('enforces aggregate Android triangle budgets even when every asset is individually valid', () => {
    const heavyBase = { ...baseBody, lods: lods('heavy-body', 50000) };
    const heavyClothing = { ...clothing, lods: lods('heavy-outfit', 40000) };
    expect(() => validateAvatarRuntimeComposition(composition({ baseBody: heavyBase, equipped: [heavyClothing, hair] }) as never)).toThrow(/visible-triangle budget/i);
  });

  it('does not trust caller-provided aggregate metrics or authority metadata', () => {
    expect(() => validateAvatarRuntimeComposition({ ...composition(), metrics: { visibleTriangles: 1 }, premiumUnlocked: true } as never)).not.toThrow();
    const certified = validateAvatarRuntimeComposition(composition());
    expect(certified.metrics.visibleTriangles).toBe(74000);
    expect('premiumUnlocked' in certified).toBe(false);
  });
});

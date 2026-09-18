import {
  HERO_AVATAR_EXPRESSIONS,
  HERO_AVATAR_KEY,
  HERO_AVATAR_REQUIRED_VIEWS,
  validateHeroAvatarProductionContract,
} from './hero-avatar.domain';
import {
  AVATAR_BODY_MORPHS,
  AVATAR_CANONICAL_FACIAL_RIG,
  AVATAR_CANONICAL_SKELETON,
  AVATAR_FACE_MORPHS,
  AvatarAssetManifest,
} from './avatar-asset-manifest.domain';

function body(): AvatarAssetManifest {
  return {
    manifestVersion: 1,
    assetKey: 'knowme.hero.body.v1',
    kind: 'BASE_BODY',
    format: 'GLB',
    skeletonKey: AVATAR_CANONICAL_SKELETON,
    facialRigKey: AVATAR_CANONICAL_FACIAL_RIG,
    materialProfileKey: 'knowme.skin.pbr.v1',
    morphTargets: [...AVATAR_BODY_MORPHS, ...AVATAR_FACE_MORPHS],
    lods: [
      { level: 0, uri: 'https://cdn.knowme.test/hero/lod0.glb', triangles: 55000, vertices: 32000, downloadBytes: 7000000 },
      { level: 1, uri: 'https://cdn.knowme.test/hero/lod1.glb', triangles: 28000, vertices: 17000, downloadBytes: 4000000 },
      { level: 2, uri: 'https://cdn.knowme.test/hero/lod2.glb', triangles: 11000, vertices: 7000, downloadBytes: 1800000 },
    ],
    textures: { baseColor: 'https://cdn.knowme.test/hero/base.webp', normal: 'https://cdn.knowme.test/hero/normal.webp', maxResolution: 2048 },
    geometry: { skinned: true, maxBonesPerVertex: 4 },
    pbr: true,
    originalDesign: true,
  };
}

function contract() {
  return {
    contractVersion: 1 as const,
    heroKey: HERO_AVATAR_KEY,
    baseBody: body(),
    referenceViews: Object.fromEntries(HERO_AVATAR_REQUIRED_VIEWS.map(v => [v, `https://cdn.knowme.test/hero/reference/${v}.webp`])) as any,
    expressions: [...HERO_AVATAR_EXPRESSIONS],
    skeletonKey: AVATAR_CANONICAL_SKELETON,
    facialRigKey: AVATAR_CANONICAL_FACIAL_RIG,
    scaleMeters: 1.72,
    neutralPose: 'A_POSE' as const,
    uvSets: 1 as const,
    pbrWorkflow: 'METALLIC_ROUGHNESS' as const,
    authoredInLinearColorSpace: true as const,
  };
}

describe('Hero Avatar production contract', () => {
  it('accepts a complete production reference', () => expect(validateHeroAvatarProductionContract(contract())).toBeTruthy());
  it('rejects a missing DNA morph', () => {
    const value = contract();
    value.baseBody.morphTargets = value.baseBody.morphTargets.filter(v => v !== 'jawWidth');
    expect(() => validateHeroAvatarProductionContract(value)).toThrow();
  });
  it('rejects a missing facial expression', () => {
    const value = contract();
    value.expressions = value.expressions.filter(v => v !== 'blinkLeft') as any;
    expect(() => validateHeroAvatarProductionContract(value)).toThrow(/blinkLeft/);
  });
  it('rejects incomplete multi-angle art references', () => {
    const value = contract();
    value.referenceViews.profileLeft = '';
    expect(() => validateHeroAvatarProductionContract(value)).toThrow(/profileLeft/);
  });
  it('rejects a non canonical rig', () => {
    const value = contract() as any;
    value.facialRigKey = 'client.fake.rig';
    expect(() => validateHeroAvatarProductionContract(value)).toThrow(/canonical/);
  });
});

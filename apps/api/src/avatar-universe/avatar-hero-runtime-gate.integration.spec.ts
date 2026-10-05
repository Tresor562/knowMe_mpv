import {
  AVATAR_BODY_MORPHS,
  AVATAR_FACE_MORPHS,
  AVATAR_CANONICAL_FACIAL_RIG,
  AVATAR_CANONICAL_SKELETON,
  AvatarAssetManifest,
  validateAvatarAssetManifest,
} from './avatar-asset-manifest.domain';
import {
  HERO_AVATAR_EXPRESSIONS,
  HERO_AVATAR_KEY,
  HERO_AVATAR_REQUIRED_VIEWS,
  HeroAvatarProductionContract,
  validateHeroAvatarProductionContract,
} from './hero-avatar.domain';

function heroBody(): AvatarAssetManifest {
  return {
    manifestVersion: 1,
    assetKey: 'knowme.hero.base-body.v1',
    kind: 'BASE_BODY',
    format: 'GLB',
    skeletonKey: AVATAR_CANONICAL_SKELETON,
    facialRigKey: AVATAR_CANONICAL_FACIAL_RIG,
    materialProfileKey: 'knowme.pbr.mobile.v1',
    morphTargets: [...AVATAR_BODY_MORPHS, ...AVATAR_FACE_MORPHS],
    geometry: { skinned: true, maxBonesPerVertex: 4 },
    lods: [
      { level: 0, uri: 'asset://runtime/avatar/hero-lod0.glb', triangles: 52000, vertices: 30000, downloadBytes: 7_000_000 },
      { level: 1, uri: 'asset://runtime/avatar/hero-lod1.glb', triangles: 28000, vertices: 17000, downloadBytes: 4_000_000 },
      { level: 2, uri: 'asset://runtime/avatar/hero-lod2.glb', triangles: 11000, vertices: 7000, downloadBytes: 1_800_000 },
    ],
    textures: {
      baseColor: 'asset://runtime/avatar/hero-base.ktx2',
      normal: 'asset://runtime/avatar/hero-normal.ktx2',
      maxResolution: 2048,
    },
    pbr: true,
    originalDesign: true,
  };
}

function heroContract(baseBody: AvatarAssetManifest = heroBody()): HeroAvatarProductionContract {
  return {
    contractVersion: 1,
    heroKey: HERO_AVATAR_KEY,
    baseBody,
    referenceViews: Object.fromEntries(
      HERO_AVATAR_REQUIRED_VIEWS.map((view) => [
        view,
        `https://cdn.knowme.test/hero/reference/${view}.webp`,
      ])
    ) as HeroAvatarProductionContract['referenceViews'],
    expressions: [...HERO_AVATAR_EXPRESSIONS],
    skeletonKey: AVATAR_CANONICAL_SKELETON,
    facialRigKey: AVATAR_CANONICAL_FACIAL_RIG,
    scaleMeters: 1.72,
    neutralPose: 'A_POSE',
    uvSets: 1,
    pbrWorkflow: 'METALLIC_ROUGHNESS',
    authoredInLinearColorSpace: true,
  };
}

describe('Hero BASE_BODY runtime certification gate', () => {
  it('certifies one canonical base body through both asset and Hero production boundaries', () => {
    const body = validateAvatarAssetManifest(heroBody());
    expect(body.kind).toBe('BASE_BODY');
    expect(validateHeroAvatarProductionContract(heroContract(body)).baseBody).toEqual(body);
  });

  it('fails closed when the canonical facial rig is replaced', () => {
    const body = heroBody();
    body.facialRigKey = 'client.fake.face';
    expect(() => validateHeroAvatarProductionContract(heroContract(body))).toThrow(/canonical|facial rig/i);
  });

  it('fails closed when a required DNA facial morph disappears', () => {
    const body = heroBody();
    body.morphTargets = body.morphTargets.filter((morph) => morph !== 'jawWidth');
    expect(() => validateHeroAvatarProductionContract(heroContract(body))).toThrow(/jawWidth/i);
  });
});

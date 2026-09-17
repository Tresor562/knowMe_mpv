import { assertAvatarSkeletonCompatibility, validateAvatarAssetManifest, AvatarAssetManifest } from './avatar-asset-manifest.domain';

const valid = (): AvatarAssetManifest => ({
  manifestVersion: 1,
  assetKey: 'knowme.hero.jacket.v1',
  kind: 'CLOTHING',
  slot: 'AVATAR_OUTFIT',
  format: 'GLB',
  skeletonKey: 'knowme.humanoid.v1',
  materialProfileKey: 'knowme.pbr.mobile.v1',
  morphTargets: ['body_height', 'body_build'],
  lods: [
    { level: 0, uri: 'https://cdn.knowme.test/avatar/jacket-lod0.glb', triangles: 42000, vertices: 25000, downloadBytes: 5_000_000 },
    { level: 1, uri: 'https://cdn.knowme.test/avatar/jacket-lod1.glb', triangles: 22000, vertices: 13000, downloadBytes: 2_500_000 },
    { level: 2, uri: 'https://cdn.knowme.test/avatar/jacket-lod2.glb', triangles: 9000, vertices: 6000, downloadBytes: 1_000_000 }
  ],
  textures: { baseColor: 'asset://textures/jacket-base', normal: 'asset://textures/jacket-normal', metallicRoughness: 'asset://textures/jacket-mr', maxResolution: 2048 },
  pbr: true,
  originalDesign: true
});

describe('Avatar 3D asset manifest', () => {
  it('accepts a mobile-ready original PBR asset with real decreasing LODs', () => expect(validateAvatarAssetManifest(valid())).toBeTruthy());
  it('rejects LOD0 over the Android triangle budget', () => { const input=valid(); input.lods[0].triangles=60001; expect(()=>validateAvatarAssetManifest(input)).toThrow(/triangle budget/i); });
  it('rejects fake LOD chains that become heavier', () => { const input=valid(); input.lods[2].triangles=23000; expect(()=>validateAvatarAssetManifest(input)).toThrow(); });
  it('rejects oversized runtime downloads', () => { const input=valid(); input.lods[0].downloadBytes=8*1024*1024+1; expect(()=>validateAvatarAssetManifest(input)).toThrow(/download budget/i); });
  it('rejects untrusted URI schemes', () => { const input=valid(); input.lods[0].uri='javascript:alert(1)'; expect(()=>validateAvatarAssetManifest(input)).toThrow(/URI/i); });
  it('rejects incompatible skeletons', () => expect(()=>assertAvatarSkeletonCompatibility('knowme.humanoid.v2',valid())).toThrow(/incompatible/i));
});

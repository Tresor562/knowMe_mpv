import { assertAvatarSkeletonCompatibility, validateAvatarAssetManifest, AvatarAssetManifest, AVATAR_BODY_MORPHS } from './avatar-asset-manifest.domain';

const HASH='a'.repeat(64);
const valid = (): AvatarAssetManifest => ({
  manifestVersion:1, assetKey:'knowme.hero.jacket.v1', kind:'CLOTHING', slot:'AVATAR_OUTFIT', format:'GLB', skeletonKey:'knowme.humanoid.v1', materialProfileKey:'knowme.pbr.mobile.v1',
  morphTargets:[...AVATAR_BODY_MORPHS], geometry:{skinned:true,maxBonesPerVertex:4},
  lods:[
    {level:0,uri:'https://cdn.knowme.test/avatar/jacket-lod0.glb',triangles:38000,vertices:25000,downloadBytes:5_000_000,sha256:HASH},
    {level:1,uri:'https://cdn.knowme.test/avatar/jacket-lod1.glb',triangles:22000,vertices:13000,downloadBytes:2_500_000,sha256:'b'.repeat(64)},
    {level:2,uri:'https://cdn.knowme.test/avatar/jacket-lod2.glb',triangles:9000,vertices:6000,downloadBytes:1_000_000,sha256:'c'.repeat(64)}],
  textures:{baseColor:'asset://textures/jacket-base',normal:'asset://textures/jacket-normal',metallicRoughness:'asset://textures/jacket-mr',maxResolution:2048},
  provenance:{sourceRevision:'hero-jacket-src-v1',exportRevision:'hero-jacket-export-v1',exporter:'blender',exporterVersion:'4.3',skeletonVersion:'knowme.humanoid.v1',validatedAt:'2026-09-20T09:00:00.000Z'},
  pbr:true,originalDesign:true
});

describe('Avatar 3D asset production gates',()=>{
 it('accepts a mobile-ready original PBR clothing asset',()=>expect(validateAvatarAssetManifest(valid())).toBeTruthy());
 it('enforces the stricter clothing triangle budget',()=>{const x=valid();x.lods[0].triangles=40001;expect(()=>validateAvatarAssetManifest(x)).toThrow(/CLOTHING.*triangle budget/i);});
 it('rejects missing PBR base color',()=>{const x=valid();delete x.textures.baseColor;expect(()=>validateAvatarAssetManifest(x)).toThrow(/baseColor/i);});
 it('validates every texture URI',()=>{const x=valid();x.textures.normal='javascript:bad';expect(()=>validateAvatarAssetManifest(x)).toThrow(/URI/i);});
 it('rejects clothing without canonical mobile skinning',()=>{const x=valid();x.geometry={skinned:true,maxBonesPerVertex:4};x.skeletonKey='other.rig.v1';expect(()=>validateAvatarAssetManifest(x)).toThrow(/canonical skeleton/i);});
 it('rejects clothing missing a body morph',()=>{const x=valid();x.morphTargets=x.morphTargets.filter(m=>m!=='bodyMass');expect(()=>validateAvatarAssetManifest(x)).toThrow(/bodyMass/i);});
 it('rejects kind/slot mismatches',()=>{const x=valid();x.slot='AVATAR_HAIR';expect(()=>validateAvatarAssetManifest(x)).toThrow(/Cosmetics slot/i);});
 it('rejects duplicate morph targets',()=>{const x=valid();x.morphTargets.push('height');expect(()=>validateAvatarAssetManifest(x)).toThrow(/Duplicate/i);});
 it('requires hair cards for mobile hair',()=>{const x=valid();x.kind='HAIR';x.slot='AVATAR_HAIR';x.skeletonKey=undefined;x.morphTargets=[];x.geometry={skinned:false,hairCards:false};expect(()=>validateAvatarAssetManifest(x)).toThrow(/hair cards/i);});
 it('rejects fake LOD chains with equal complexity',()=>{const x=valid();x.lods[1].triangles=x.lods[0].triangles;expect(()=>validateAvatarAssetManifest(x)).toThrow(/strictly decrease/i);});
 it('rejects cosmetic LOD reductions too small to matter on mobile',()=>{const x=valid();x.lods[1].triangles=31000;x.lods[2].triangles=11000;expect(()=>validateAvatarAssetManifest(x)).toThrow(/reduce geometry enough/i);});
 it('rejects oversized downloads',()=>{const x=valid();x.lods[0].downloadBytes=8*1024*1024+1;expect(()=>validateAvatarAssetManifest(x)).toThrow(/download budget/i);});
 it('rejects runtime LODs without content-addressable checksums',()=>{const x=valid();x.lods[2].sha256='not-a-hash';expect(()=>validateAvatarAssetManifest(x)).toThrow(/SHA-256/i);});
 it('requires production provenance',()=>{const x=valid();delete (x as Partial<AvatarAssetManifest>).provenance;expect(()=>validateAvatarAssetManifest(x)).toThrow(/production provenance/i);});
 it('binds production provenance to the canonical skeleton',()=>{const x=valid();x.provenance.skeletonVersion='knowme.humanoid.v2';expect(()=>validateAvatarAssetManifest(x)).toThrow(/provenance skeleton/i);});
 it('rejects impossible provenance timestamps',()=>{const x=valid();x.provenance.validatedAt='not-a-date';expect(()=>validateAvatarAssetManifest(x)).toThrow(/validation timestamp/i);});
 it('rejects incompatible equipped skeletons',()=>expect(()=>assertAvatarSkeletonCompatibility('knowme.humanoid.v2',valid())).toThrow(/incompatible/i));
});

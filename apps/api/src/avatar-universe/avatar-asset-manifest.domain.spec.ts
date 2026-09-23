import { assertAvatarSkeletonCompatibility, validateAvatarAssetManifest, AvatarAssetManifest, AVATAR_BODY_MORPHS } from './avatar-asset-manifest.domain';

const valid = (): AvatarAssetManifest => ({
  manifestVersion:1, assetKey:'knowme.hero.jacket.v1', kind:'CLOTHING', slot:'AVATAR_OUTFIT', format:'GLB', skeletonKey:'knowme.humanoid.v1', materialProfileKey:'knowme.pbr.mobile.v1',
  morphTargets:[...AVATAR_BODY_MORPHS], geometry:{skinned:true,maxBonesPerVertex:4},
  lods:[
    {level:0,uri:'https://cdn.knowme.test/avatar/jacket-lod0.glb',triangles:38000,vertices:25000,downloadBytes:5_000_000},
    {level:1,uri:'https://cdn.knowme.test/avatar/jacket-lod1.glb',triangles:22000,vertices:13000,downloadBytes:2_500_000},
    {level:2,uri:'https://cdn.knowme.test/avatar/jacket-lod2.glb',triangles:9000,vertices:6000,downloadBytes:1_000_000}],
  textures:{baseColor:'asset://textures/jacket-base',normal:'asset://textures/jacket-normal',metallicRoughness:'asset://textures/jacket-mr',maxResolution:2048},pbr:true,originalDesign:true
});

describe('Avatar 3D asset production gates',()=>{
 it('accepts a mobile-ready original PBR clothing asset',()=>expect(validateAvatarAssetManifest(valid())).toBeTruthy());
 it('returns a detached canonical projection rather than the input object',()=>{const x=valid();const result=validateAvatarAssetManifest(x);expect(result).not.toBe(x);expect(result.lods).not.toBe(x.lods);expect(result.textures).not.toBe(x.textures);expect(result.geometry).not.toBe(x.geometry);expect(result.morphTargets).not.toBe(x.morphTargets);});
 it('rejects unknown top-level metadata',()=>{const x=valid() as AvatarAssetManifest & {clientNote?:string};x.clientNote='extra';expect(()=>validateAvatarAssetManifest(x)).toThrow(/Unknown avatar asset manifest field: clientNote/i);});
 it('rejects unknown LOD metadata',()=>{const x=valid();(x.lods[0] as typeof x.lods[0] & {clientTag?:string}).clientTag='extra';expect(()=>validateAvatarAssetManifest(x)).toThrow(/Unknown avatar LOD field: clientTag/i);});
 it('rejects unknown texture metadata',()=>{const x=valid();(x.textures as typeof x.textures & {clientTag?:string}).clientTag='extra';expect(()=>validateAvatarAssetManifest(x)).toThrow(/Unknown avatar texture field: clientTag/i);});
 it('rejects unknown geometry metadata',()=>{const x=valid();(x.geometry as NonNullable<typeof x.geometry> & {clientTag?:string}).clientTag='extra';expect(()=>validateAvatarAssetManifest(x)).toThrow(/Unknown avatar geometry field: clientTag/i);});
 it('enforces the stricter clothing triangle budget',()=>{const x=valid();x.lods[0].triangles=40001;expect(()=>validateAvatarAssetManifest(x)).toThrow(/CLOTHING.*triangle budget/i);});
 it('rejects missing PBR base color',()=>{const x=valid();delete x.textures.baseColor;expect(()=>validateAvatarAssetManifest(x)).toThrow(/baseColor/i);});
 it('validates every texture URI',()=>{const x=valid();x.textures.normal='javascript:bad';expect(()=>validateAvatarAssetManifest(x)).toThrow(/URI/i);});
 it('rejects clothing without canonical mobile skinning',()=>{const x=valid();x.geometry={skinned:true,maxBonesPerVertex:4};x.skeletonKey='other.rig.v1';expect(()=>validateAvatarAssetManifest(x)).toThrow(/canonical skeleton/i);});
 it('rejects clothing missing a body morph',()=>{const x=valid();x.morphTargets=x.morphTargets.filter(m=>m!=='bodyMass');expect(()=>validateAvatarAssetManifest(x)).toThrow(/bodyMass/i);});
 it('rejects kind/slot mismatches',()=>{const x=valid();x.slot='AVATAR_HAIR';expect(()=>validateAvatarAssetManifest(x)).toThrow(/Cosmetics slot/i);});
 it('rejects duplicate morph targets',()=>{const x=valid();x.morphTargets.push('height');expect(()=>validateAvatarAssetManifest(x)).toThrow(/Duplicate/i);});
 it('requires hair cards for mobile hair',()=>{const x=valid();x.kind='HAIR';x.slot='AVATAR_HAIR';x.skeletonKey=undefined;x.morphTargets=[];x.geometry={skinned:false,hairCards:false};expect(()=>validateAvatarAssetManifest(x)).toThrow(/hair cards/i);});
 it('rejects fake LOD chains with equal complexity',()=>{const x=valid();x.lods[1].triangles=x.lods[0].triangles;expect(()=>validateAvatarAssetManifest(x)).toThrow(/reduce by at least/i);});
 it('requires LOD1 to remove at least 25 percent of triangle complexity',()=>{const x=valid();x.lods[1].triangles=Math.floor(x.lods[0].triangles*0.76);expect(()=>validateAvatarAssetManifest(x)).toThrow(/LOD1 triangles.*25%/i);});
 it('requires LOD2 to remove at least 50 percent of previous triangle complexity',()=>{const x=valid();x.lods[2].triangles=Math.floor(x.lods[1].triangles*0.51);expect(()=>validateAvatarAssetManifest(x)).toThrow(/LOD2 triangles.*50%/i);});
 it('requires meaningful vertex reduction instead of triangle-only decimation evidence',()=>{const x=valid();x.lods[1].vertices=Math.floor(x.lods[0].vertices*0.80);expect(()=>validateAvatarAssetManifest(x)).toThrow(/LOD1 vertices.*25%/i);});
 it('rejects oversized LOD0 downloads',()=>{const x=valid();x.lods[0].downloadBytes=8*1024*1024+1;expect(()=>validateAvatarAssetManifest(x)).toThrow(/download budget/i);});
 it('rejects oversized LOD1 downloads',()=>{const x=valid();x.lods[1].downloadBytes=4*1024*1024+1;expect(()=>validateAvatarAssetManifest(x)).toThrow(/download budget/i);});
 it('rejects oversized LOD2 downloads',()=>{const x=valid();x.lods[2].downloadBytes=2*1024*1024+1;expect(()=>validateAvatarAssetManifest(x)).toThrow(/download budget/i);});
 it('rejects LOD geometry reductions that do not reduce transfer payload',()=>{const x=valid();x.lods[1].downloadBytes=x.lods[0].downloadBytes;expect(()=>validateAvatarAssetManifest(x)).toThrow(/payload must be smaller/i);});
 it('rejects reuse of one runtime payload for multiple LOD levels',()=>{const x=valid();x.lods[2].uri=x.lods[1].uri;expect(()=>validateAvatarAssetManifest(x)).toThrow(/distinct runtime payloads/i);});
 it('rejects incompatible equipped skeletons',()=>expect(()=>assertAvatarSkeletonCompatibility('knowme.humanoid.v2',valid())).toThrow(/incompatible/i));
});

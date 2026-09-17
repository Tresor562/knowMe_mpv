import { AVATAR_ALL_SLOTS, AvatarSlot } from './avatar-universe.domain';

export const AVATAR_ASSET_MANIFEST_VERSION = 1 as const;
export const AVATAR_ASSET_FORMATS = ['GLB', 'GLTF'] as const;
export type AvatarAssetFormat = (typeof AVATAR_ASSET_FORMATS)[number];
export const AVATAR_ASSET_KINDS = ['BASE_BODY','HAIR','FACE','SKIN','CLOTHING','FOOTWEAR','HEADWEAR','ACCESSORY','BACK_ITEM','HAND_ITEM','WEAPON_STYLE','AURA','COMPANION'] as const;
export type AvatarAssetKind = (typeof AVATAR_ASSET_KINDS)[number];

export type AvatarLod = { level: 0|1|2; uri:string; triangles:number; vertices:number; downloadBytes:number };
export type AvatarTextureSet = { baseColor?:string; normal?:string; metallicRoughness?:string; occlusion?:string; emissive?:string; maxResolution:512|1024|2048 };
export type AvatarAssetManifest = {
  manifestVersion: typeof AVATAR_ASSET_MANIFEST_VERSION;
  assetKey:string;
  kind:AvatarAssetKind;
  slot?:AvatarSlot;
  format:AvatarAssetFormat;
  skeletonKey?:string;
  facialRigKey?:string;
  materialProfileKey:string;
  morphTargets:string[];
  lods:AvatarLod[];
  textures:AvatarTextureSet;
  pbr:true;
  originalDesign:true;
};

export const AVATAR_MOBILE_ASSET_BUDGETS = Object.freeze({
  maxLod0Triangles: 60000,
  maxLod1Triangles: 30000,
  maxLod2Triangles: 12000,
  maxLod0DownloadBytes: 8 * 1024 * 1024,
  maxTextureResolution: 2048,
  maxMorphTargetsPerAsset: 32
});

const SAFE_KEY=/^[a-z0-9][a-z0-9._-]{1,95}$/i;
function assertKey(value:string,label:string){ if(!SAFE_KEY.test(value)) throw new Error(`Invalid ${label}.`); }
function assertUri(uri:string){ if(!(uri.startsWith('https://')||uri.startsWith('asset://'))) throw new Error('Avatar asset URI must use https:// or asset://.'); }

export function validateAvatarAssetManifest(input:AvatarAssetManifest):AvatarAssetManifest {
  if(input.manifestVersion!==AVATAR_ASSET_MANIFEST_VERSION) throw new Error('Unsupported avatar asset manifest version.');
  if(!AVATAR_ASSET_FORMATS.includes(input.format)) throw new Error('Unsupported avatar asset format.');
  if(!AVATAR_ASSET_KINDS.includes(input.kind)) throw new Error('Unsupported avatar asset kind.');
  assertKey(input.assetKey,'asset key'); assertKey(input.materialProfileKey,'material profile key');
  if(input.slot && !AVATAR_ALL_SLOTS.includes(input.slot)) throw new Error('Unsupported avatar slot.');
  if(input.skeletonKey) assertKey(input.skeletonKey,'skeleton key');
  if(input.facialRigKey) assertKey(input.facialRigKey,'facial rig key');
  if(input.pbr!==true || input.originalDesign!==true) throw new Error('Avatar runtime assets must be PBR and original designs.');
  if(!Array.isArray(input.lods)||input.lods.length!==3) throw new Error('Avatar assets require exactly LOD0, LOD1 and LOD2.');
  const sorted=[...input.lods].sort((a,b)=>a.level-b.level);
  if(sorted.some((lod,index)=>lod.level!==index)) throw new Error('Avatar LOD levels must be 0, 1 and 2.');
  for(const lod of sorted){ assertUri(lod.uri); if(!Number.isSafeInteger(lod.triangles)||lod.triangles<=0||!Number.isSafeInteger(lod.vertices)||lod.vertices<=0||!Number.isSafeInteger(lod.downloadBytes)||lod.downloadBytes<=0) throw new Error('Invalid avatar LOD metrics.'); }
  if(sorted[0].triangles>AVATAR_MOBILE_ASSET_BUDGETS.maxLod0Triangles||sorted[1].triangles>AVATAR_MOBILE_ASSET_BUDGETS.maxLod1Triangles||sorted[2].triangles>AVATAR_MOBILE_ASSET_BUDGETS.maxLod2Triangles) throw new Error('Avatar asset exceeds mobile triangle budget.');
  if(sorted[0].downloadBytes>AVATAR_MOBILE_ASSET_BUDGETS.maxLod0DownloadBytes) throw new Error('Avatar asset exceeds mobile download budget.');
  if(sorted[1].triangles>sorted[0].triangles||sorted[2].triangles>sorted[1].triangles) throw new Error('Avatar LOD triangle counts must decrease.');
  if(![512,1024,2048].includes(input.textures.maxResolution)||input.textures.maxResolution>AVATAR_MOBILE_ASSET_BUDGETS.maxTextureResolution) throw new Error('Avatar texture resolution exceeds mobile budget.');
  if(input.morphTargets.length>AVATAR_MOBILE_ASSET_BUDGETS.maxMorphTargetsPerAsset) throw new Error('Too many morph targets for avatar asset.');
  for(const morph of input.morphTargets) assertKey(morph,'morph target');
  return input;
}

export function assertAvatarSkeletonCompatibility(baseSkeletonKey:string,asset:AvatarAssetManifest){
  if(asset.skeletonKey && asset.skeletonKey!==baseSkeletonKey) throw new Error('Avatar asset skeleton is incompatible with the equipped base body.');
  return true;
}

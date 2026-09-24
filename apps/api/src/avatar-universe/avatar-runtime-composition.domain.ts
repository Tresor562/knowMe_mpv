import { AvatarAssetManifest, AVATAR_BODY_MORPHS, AVATAR_CANONICAL_FACIAL_RIG, AVATAR_CANONICAL_SKELETON, validateAvatarAssetManifest } from './avatar-asset-manifest.domain';
import { AvatarDNA, validateAvatarDNA } from './avatar-dna.domain';
import { AvatarRenderProfile, validateAvatarRenderProfile } from './avatar-render-profile.domain';

export type AvatarRuntimeComposition = { dna:AvatarDNA; renderProfile:AvatarRenderProfile; baseBody:AvatarAssetManifest; equipped:AvatarAssetManifest[] };
export type AvatarRuntimeCompositionMetrics = { visibleTriangles:number; estimatedDrawCalls:number; skinnedMeshes:number; lodLevel:0|1|2 };
export type CertifiedAvatarRuntimeComposition = AvatarRuntimeComposition & { metrics:AvatarRuntimeCompositionMetrics };
const COMPOSITION_KEYS=new Set(['dna','renderProfile','baseBody','equipped']);

function requiredMorphs(asset:AvatarAssetManifest,names:readonly string[],label:string){for(const name of names)if(!asset.morphTargets.includes(name))throw new Error(`${label} cannot follow Avatar DNA control ${name}`);}
function canonicalAsset(value:AvatarAssetManifest,label:string){try{return validateAvatarAssetManifest(value);}catch(error){throw new Error(`${label} is not runtime-certified: ${error instanceof Error?error.message:'invalid asset'}`);}}
function assertCompositionShape(value:unknown):asserts value is AvatarRuntimeComposition{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Runtime composition must be an object');
  const source=value as Record<string,unknown>;
  for(const key of Object.keys(source))if(!COMPOSITION_KEYS.has(key))throw new Error(`Unknown runtime composition field: ${key}`);
  for(const key of COMPOSITION_KEYS)if(!(key in source))throw new Error(`Missing runtime composition field: ${key}`);
  if(!Array.isArray(source.equipped))throw new Error('Runtime composition equipped assets must be an array');
}

/** Final geometry/rig/morph/mobile-budget gate before the renderer consumes assembled GLBs. Ownership and pricing remain server-authoritative in Cosmetics. */
export function validateAvatarRuntimeComposition(value:unknown,lodLevel:0|1|2=0):CertifiedAvatarRuntimeComposition{
  assertCompositionShape(value);
  const dna=validateAvatarDNA(value.dna),renderProfile=validateAvatarRenderProfile(value.renderProfile);
  if(renderProfile.tier!==dna.renderTier)throw new Error('Avatar DNA render tier does not match the certified render profile');
  if(renderProfile.tier==='LAYERED_2D')throw new Error('A 3D runtime composition cannot use the LAYERED_2D render tier');
  const baseBody=canonicalAsset(value.baseBody,'Base body');
  if(baseBody.kind!=='BASE_BODY')throw new Error('Runtime composition requires a certified BASE_BODY');
  if(baseBody.skeletonKey!==dna.skeletonKey||dna.skeletonKey!==AVATAR_CANONICAL_SKELETON)throw new Error('Base body skeleton does not match Avatar DNA');
  if(dna.facialRigKey!==AVATAR_CANONICAL_FACIAL_RIG)throw new Error('Avatar DNA facial rig is not canonical');
  requiredMorphs(baseBody,AVATAR_BODY_MORPHS,'Base body');
  const equipped=value.equipped.map((asset,index)=>canonicalAsset(asset,`Equipped asset ${index}`)),slots=new Set<string>();
  for(const asset of equipped){
    if(!asset.slot)throw new Error('Equipped runtime assets require a Cosmetics slot');
    if(slots.has(asset.slot))throw new Error(`Runtime composition contains multiple assets for slot ${asset.slot}`);slots.add(asset.slot);
    if(asset.skeletonKey&&asset.skeletonKey!==dna.skeletonKey)throw new Error(`Asset ${asset.assetKey} uses an incompatible skeleton`);
    if(asset.facialRigKey&&asset.facialRigKey!==dna.facialRigKey)throw new Error(`Asset ${asset.assetKey} uses an incompatible facial rig`);
    if(asset.kind==='CLOTHING')requiredMorphs(asset,AVATAR_BODY_MORPHS,`Clothing ${asset.assetKey}`);
  }
  const all=[baseBody,...equipped];
  const visibleTriangles=all.reduce((sum,asset)=>sum+asset.lods[lodLevel].triangles,0);
  const skinnedMeshes=all.reduce((sum,asset)=>sum+(asset.geometry?.skinned?1:0),0);
  const estimatedDrawCalls=all.reduce((sum,asset)=>sum+1+(['normal','metallicRoughness','occlusion','emissive'] as const).filter(key=>Boolean(asset.textures[key])).length,0);
  if(visibleTriangles>renderProfile.android.maxVisibleTriangles)throw new Error('Assembled avatar exceeds the render profile visible-triangle budget');
  if(skinnedMeshes>renderProfile.android.maxSkinnedMeshes)throw new Error('Assembled avatar exceeds the render profile skinned-mesh budget');
  if(estimatedDrawCalls>renderProfile.android.maxDrawCalls)throw new Error('Assembled avatar exceeds the render profile draw-call budget');
  return{dna,renderProfile,baseBody,equipped,metrics:{visibleTriangles,estimatedDrawCalls,skinnedMeshes,lodLevel}};
}

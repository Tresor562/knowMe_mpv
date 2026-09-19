import { HeroRuntimeBundle, inspectHeroRuntimeGlb, verifyHeroRuntimeBundleBytes, HERO_RUNTIME_MORPH_TARGETS } from './hero-runtime-bundle-v13.domain';
import { inspectHeroRuntimePbrGlb } from './hero-runtime-pbr-v14.domain';

export const HERO_RUNTIME_ANDROID_GATE_VERSION=15 as const;
// Conservative decoded GPU-residency ceilings, per LOD. They are deliberately lower than
// typical device memory: one avatar must leave room for cosmetics, renderer and UI.
export const HERO_RUNTIME_ANDROID_MAX_RESIDENT_BYTES=[48,32,20].map(m=>m*1024*1024) as readonly number[];
export const HERO_RUNTIME_ANDROID_MAX_TRIANGLES=[60000,30000,12000] as const;
export const HERO_RUNTIME_ANDROID_MAX_VERTICES=[65000,40000,22000] as const;
// Conservative resident layout: position+normal+tangent+uv + joints+weights.
// Morph POSITION buffers are counted independently because the runtime may keep them GPU-resident.
const BASE_VERTEX_BYTES=12+12+16+8+8+16;
const MORPH_VERTEX_BYTES=12;
const INDEX_BYTES_WORST_CASE=4;
const SKIN_MATRIX_RESERVE_BYTES=256*64; // room for 256 mat4 joint matrices.

export type HeroAndroidLodBudget={
 level:0|1|2;
 vertices:number;
 triangles:number;
 textureBytes:number;
 estimatedGeometryBytes:number;
 estimatedMorphBytes:number;
 estimatedResidentBytes:number;
 residentBudgetBytes:number;
};

export function inspectHeroRuntimeAndroidLod(bytes:Uint8Array,level:0|1|2):HeroAndroidLodBudget{
 const geometry=inspectHeroRuntimeGlb(bytes);
 const pbr=inspectHeroRuntimePbrGlb(bytes);
 if(geometry.vertices>HERO_RUNTIME_ANDROID_MAX_VERTICES[level])throw new Error(`Android LOD${level} exceeds vertex budget.`);
 if(geometry.triangles>HERO_RUNTIME_ANDROID_MAX_TRIANGLES[level])throw new Error(`Android LOD${level} exceeds triangle budget.`);
 const estimatedGeometryBytes=geometry.vertices*BASE_VERTEX_BYTES+geometry.triangles*3*INDEX_BYTES_WORST_CASE+SKIN_MATRIX_RESERVE_BYTES;
 const estimatedMorphBytes=geometry.vertices*HERO_RUNTIME_MORPH_TARGETS.length*MORPH_VERTEX_BYTES;
 const estimatedResidentBytes=estimatedGeometryBytes+estimatedMorphBytes+pbr.estimatedGpuTextureBytes;
 const residentBudgetBytes=HERO_RUNTIME_ANDROID_MAX_RESIDENT_BYTES[level];
 if(!Number.isSafeInteger(estimatedResidentBytes)||estimatedResidentBytes>residentBudgetBytes)throw new Error(`Android LOD${level} exceeds estimated GPU residency budget.`);
 return {level,vertices:geometry.vertices,triangles:geometry.triangles,textureBytes:pbr.estimatedGpuTextureBytes,estimatedGeometryBytes,estimatedMorphBytes,estimatedResidentBytes,residentBudgetBytes};
}

export function verifyHeroRuntimeBundleAndroidBytes(bundle:HeroRuntimeBundle,files:ReadonlyMap<string,Uint8Array>){
 verifyHeroRuntimeBundleBytes(bundle,files);
 const lods=bundle.lods.map((lod,index)=>{
  const bytes=files.get(lod.fileName);if(!bytes)throw new Error(`Missing runtime bytes for ${lod.fileName}.`);
  return inspectHeroRuntimeAndroidLod(bytes,index as 0|1|2);
 });
 // Residency must materially fall with each LOD; otherwise the lower LOD is not a useful mobile fallback.
 if(!(lods[1].estimatedResidentBytes<lods[0].estimatedResidentBytes&&lods[2].estimatedResidentBytes<lods[1].estimatedResidentBytes))throw new Error('Android Hero residency must decrease strictly across LOD0/LOD1/LOD2.');
 return {gateVersion:HERO_RUNTIME_ANDROID_GATE_VERSION,lods};
}

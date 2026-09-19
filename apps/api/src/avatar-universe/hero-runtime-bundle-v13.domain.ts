import { createHash } from 'node:crypto';
import { AVATAR_CANONICAL_SKELETON } from './avatar-asset-manifest.domain';
import { HERO_BLOCKOUT_ASSET_KEY,HERO_DNA_MORPH_NAMES,HERO_EXPRESSION_MORPH_NAMES,HeroBlockoutReport,validateHeroBlockoutReport } from './hero-blockout-report-v12.domain';

export const HERO_RUNTIME_BUNDLE_VERSION=13 as const;
export const HERO_RUNTIME_FORMAT='GLB' as const;
export const HERO_RUNTIME_MAX_BYTES=[8*1024*1024,5*1024*1024,3*1024*1024] as const;
export const HERO_RUNTIME_MORPH_TARGETS=[...HERO_DNA_MORPH_NAMES,...HERO_EXPRESSION_MORPH_NAMES] as const;
export type HeroRuntimeLod={level:0|1|2;fileName:string;sha256:string;downloadBytes:number;vertices:number;triangles:number};
export type HeroRuntimeBundle={bundleVersion:typeof HERO_RUNTIME_BUNDLE_VERSION;assetKey:typeof HERO_BLOCKOUT_ASSET_KEY;format:typeof HERO_RUNTIME_FORMAT;skeletonKey:typeof AVATAR_CANONICAL_SKELETON;morphTargets:string[];lods:HeroRuntimeLod[];sourceReport:HeroBlockoutReport};
const SHA256=/^[a-f0-9]{64}$/;
const FILE=/^knowme-hero-lod([012])\.glb$/;
const positiveInt=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;

export function sha256RuntimeBytes(bytes:Uint8Array){return createHash('sha256').update(bytes).digest('hex');}

export function validateHeroRuntimeBundle(input:HeroRuntimeBundle):HeroRuntimeBundle{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Hero runtime bundle must be an object.');
 if(input.bundleVersion!==HERO_RUNTIME_BUNDLE_VERSION)throw new Error('Unsupported Hero runtime bundle version.');
 if(input.assetKey!==HERO_BLOCKOUT_ASSET_KEY||input.format!==HERO_RUNTIME_FORMAT)throw new Error('Hero runtime bundle identity is invalid.');
 if(input.skeletonKey!==AVATAR_CANONICAL_SKELETON)throw new Error('Hero runtime bundle must use the canonical skeleton.');
 validateHeroBlockoutReport(input.sourceReport);
 if(!Array.isArray(input.morphTargets)||input.morphTargets.length!==HERO_RUNTIME_MORPH_TARGETS.length||HERO_RUNTIME_MORPH_TARGETS.some((n,i)=>input.morphTargets[i]!==n))throw new Error('Hero runtime morph contract is non-canonical.');
 if(!Array.isArray(input.lods)||input.lods.length!==3)throw new Error('Hero runtime bundle requires exactly three LOD files.');
 input.lods.forEach((lod,index)=>{
  if(!lod||lod.level!==index||lod.fileName!==`knowme-hero-lod${index}.glb`||!FILE.test(lod.fileName))throw new Error('Hero runtime LOD identity is non-canonical.');
  if(!SHA256.test(lod.sha256))throw new Error('Hero runtime LOD SHA-256 is invalid.');
  if(!positiveInt(lod.downloadBytes)||lod.downloadBytes>HERO_RUNTIME_MAX_BYTES[index])throw new Error('Hero runtime LOD exceeds byte budget.');
  const measured=input.sourceReport.lodMetrics[index];
  if(lod.vertices!==measured.vertices||lod.triangles!==measured.triangles)throw new Error('Hero runtime LOD geometry does not match certified source evidence.');
 });
 return input;
}

export function verifyHeroRuntimeBundleBytes(bundle:HeroRuntimeBundle,files:ReadonlyMap<string,Uint8Array>){
 validateHeroRuntimeBundle(bundle);
 if(files.size!==3)throw new Error('Hero runtime byte set must contain exactly three files.');
 for(const lod of bundle.lods){
  const bytes=files.get(lod.fileName);if(!bytes)throw new Error(`Missing runtime bytes for ${lod.fileName}.`);
  if(bytes.byteLength!==lod.downloadBytes)throw new Error(`Runtime byte length mismatch for ${lod.fileName}.`);
  if(sha256RuntimeBytes(bytes)!==lod.sha256)throw new Error(`Runtime SHA-256 mismatch for ${lod.fileName}.`);
 }
 for(const name of files.keys())if(!bundle.lods.some(l=>l.fileName===name))throw new Error(`Unexpected runtime file ${name}.`);
 return true;
}

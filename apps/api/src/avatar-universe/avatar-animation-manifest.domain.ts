import { AVATAR_CANONICAL_FACIAL_RIG, AVATAR_CANONICAL_SKELETON, AVATAR_EXPRESSION_MORPHS } from './avatar-asset-manifest.domain';

export const AVATAR_ANIMATION_MANIFEST_VERSION = 1 as const;
export const AVATAR_ANIMATION_KINDS = ['BODY','FACIAL','COMBINED'] as const;
export type AvatarAnimationKind = (typeof AVATAR_ANIMATION_KINDS)[number];
export type AvatarAnimationManifest = {
  manifestVersion: typeof AVATAR_ANIMATION_MANIFEST_VERSION;
  clipKey: string;
  kind: AvatarAnimationKind;
  uri: string;
  durationMs: number;
  loop: boolean;
  skeletonKey?: string;
  facialRigKey?: string;
  drivenMorphTargets: string[];
  sampleRate: 30|60;
  payloadSha256: string;
  payloadBytes: number;
  manifestSha256: string;
  certifiedAt: string;
};

const SAFE_KEY=/^[a-z0-9][a-z0-9._-]{1,95}$/i;
const SHA256=/^[a-f0-9]{64}$/i;
const MAX_CLOCK_SKEW_MS=5*60*1000;
const MANIFEST_KEYS=new Set(['manifestVersion','clipKey','kind','uri','durationMs','loop','skeletonKey','facialRigKey','drivenMorphTargets','sampleRate','payloadSha256','payloadBytes','manifestSha256','certifiedAt']);
const EXPRESSION_SET=new Set<string>(AVATAR_EXPRESSION_MORPHS);
function assertPlainObject(value:unknown):asserts value is Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Avatar animation manifest must be an object.');}
function assertOnlyKnownKeys(value:Record<string,unknown>){for(const key of Object.keys(value))if(!MANIFEST_KEYS.has(key))throw new Error(`Unknown avatar animation manifest field: ${key}`);}
function assertKey(value:string,label:string){if(typeof value!=='string'||!SAFE_KEY.test(value))throw new Error(`Invalid ${label}.`);}
function assertRuntimeUri(uri:string){if(typeof uri!=='string'||!uri.startsWith('asset://runtime/avatar/animations/')||uri.includes('..')||uri.includes('?')||uri.includes('#')||!uri.toLowerCase().endsWith('.glb'))throw new Error('Avatar animation URI must be an internal certified runtime GLB animation asset.');}
function assertDigest(value:string,label:string){if(typeof value!=='string'||!SHA256.test(value))throw new Error(`${label} must be a SHA-256 digest.`);}
function assertCertificationTime(value:string){if(typeof value!=='string')throw new Error('Animation certification time is invalid.');const ms=Date.parse(value);if(!Number.isFinite(ms)||new Date(ms).toISOString()!==value||ms>Date.now()+MAX_CLOCK_SKEW_MS)throw new Error('Animation certification time is invalid.');}

/** Validates untrusted animation metadata and immutable artifact evidence, then returns a detached canonical projection. */
export function validateAvatarAnimationManifest(input:AvatarAnimationManifest):AvatarAnimationManifest{
  assertPlainObject(input);assertOnlyKnownKeys(input as unknown as Record<string,unknown>);
  if(input.manifestVersion!==AVATAR_ANIMATION_MANIFEST_VERSION)throw new Error('Unsupported avatar animation manifest version.');
  if(!AVATAR_ANIMATION_KINDS.includes(input.kind))throw new Error('Unsupported avatar animation kind.');
  assertKey(input.clipKey,'animation clip key');assertRuntimeUri(input.uri);
  if(!Number.isSafeInteger(input.durationMs)||input.durationMs<100||input.durationMs>120_000)throw new Error('Invalid avatar animation duration.');
  if(typeof input.loop!=='boolean')throw new Error('Avatar animation loop must be boolean.');
  if(input.sampleRate!==30&&input.sampleRate!==60)throw new Error('Avatar animation sample rate must be 30 or 60 FPS.');
  if(!Array.isArray(input.drivenMorphTargets)||new Set(input.drivenMorphTargets).size!==input.drivenMorphTargets.length)throw new Error('Avatar animation morph targets must be unique.');
  for(const morph of input.drivenMorphTargets)assertKey(morph,'animation morph target');
  assertDigest(input.payloadSha256,'Animation payload digest');assertDigest(input.manifestSha256,'Animation manifest digest');
  if(!Number.isSafeInteger(input.payloadBytes)||input.payloadBytes<=0)throw new Error('Animation payload size must be a positive safe integer.');
  assertCertificationTime(input.certifiedAt);
  const body=input.kind==='BODY'||input.kind==='COMBINED';const face=input.kind==='FACIAL'||input.kind==='COMBINED';
  if(body&&input.skeletonKey!==AVATAR_CANONICAL_SKELETON)throw new Error('Body animation must target the canonical avatar skeleton.');
  if(!body&&input.skeletonKey!==undefined)throw new Error('Facial-only animation cannot declare a body skeleton.');
  if(face&&input.facialRigKey!==AVATAR_CANONICAL_FACIAL_RIG)throw new Error('Facial animation must target the canonical facial rig.');
  if(!face&&input.facialRigKey!==undefined)throw new Error('Body-only animation cannot declare a facial rig.');
  if(!face&&input.drivenMorphTargets.length)throw new Error('Body-only animation cannot drive facial morph targets.');
  if(face){if(!input.drivenMorphTargets.length)throw new Error('Facial animation must drive at least one certified expression morph.');for(const morph of input.drivenMorphTargets)if(!EXPRESSION_SET.has(morph))throw new Error(`Facial animation drives unsupported morph target ${morph}.`);}
  const result:AvatarAnimationManifest={manifestVersion:AVATAR_ANIMATION_MANIFEST_VERSION,clipKey:input.clipKey,kind:input.kind,uri:input.uri,durationMs:input.durationMs,loop:input.loop,drivenMorphTargets:[...input.drivenMorphTargets],sampleRate:input.sampleRate,payloadSha256:input.payloadSha256.toLowerCase(),payloadBytes:input.payloadBytes,manifestSha256:input.manifestSha256.toLowerCase(),certifiedAt:input.certifiedAt};
  if(input.skeletonKey!==undefined)result.skeletonKey=input.skeletonKey;if(input.facialRigKey!==undefined)result.facialRigKey=input.facialRigKey;return result;
}

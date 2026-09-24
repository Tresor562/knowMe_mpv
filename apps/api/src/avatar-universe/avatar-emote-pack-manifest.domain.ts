import { AvatarAnimationManifest, validateAvatarAnimationManifest } from './avatar-animation-manifest.domain';

export const AVATAR_EMOTE_PACK_MANIFEST_VERSION = 1 as const;
export const AVATAR_EMOTE_PACK_MOBILE_BUDGETS=Object.freeze({minClips:2,maxClips:32,maxClipDurationMs:15_000,maxClipPayloadBytes:2*1024*1024,maxPackPayloadBytes:16*1024*1024});
export type AvatarEmotePackManifest = {
  manifestVersion: typeof AVATAR_EMOTE_PACK_MANIFEST_VERSION;
  packKey: string;
  clips: AvatarAnimationManifest[];
  manifestSha256: string;
  certifiedAt: string;
};

const SAFE_KEY=/^[a-z0-9][a-z0-9._-]{1,95}$/i;
const SHA256=/^[a-f0-9]{64}$/i;
const MAX_CLOCK_SKEW_MS=5*60*1000;
const PACK_KEYS=new Set(['manifestVersion','packKey','clips','manifestSha256','certifiedAt']);

function assertPlainObject(value:unknown):asserts value is Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Avatar emote pack manifest must be an object.');}
function assertCertificationTime(value:string){if(typeof value!=='string')throw new Error('Emote pack certification time is invalid.');const ms=Date.parse(value);if(!Number.isFinite(ms)||new Date(ms).toISOString()!==value||ms>Date.now()+MAX_CLOCK_SKEW_MS)throw new Error('Emote pack certification time is invalid.');}

/**
 * Certifies a logical emote pack as a bounded set of independently certified GLB clips.
 * The pack contains no client pricing, ownership or Premium authority. Mobile budgets are
 * enforced on each clip and on the aggregate payload so a valid pack is safe to cache/download.
 */
export function validateAvatarEmotePackManifest(input:AvatarEmotePackManifest):AvatarEmotePackManifest{
  assertPlainObject(input);
  for(const key of Object.keys(input))if(!PACK_KEYS.has(key))throw new Error(`Unknown avatar emote pack manifest field: ${key}`);
  if(input.manifestVersion!==AVATAR_EMOTE_PACK_MANIFEST_VERSION)throw new Error('Unsupported avatar emote pack manifest version.');
  if(typeof input.packKey!=='string'||!SAFE_KEY.test(input.packKey))throw new Error('Invalid avatar emote pack key.');
  const b=AVATAR_EMOTE_PACK_MOBILE_BUDGETS;
  if(!Array.isArray(input.clips)||input.clips.length<b.minClips||input.clips.length>b.maxClips)throw new Error(`Avatar emote packs require ${b.minClips}-${b.maxClips} certified clips.`);
  if(typeof input.manifestSha256!=='string'||!SHA256.test(input.manifestSha256))throw new Error('Emote pack manifest digest must be a SHA-256 digest.');
  assertCertificationTime(input.certifiedAt);
  const clips=input.clips.map(validateAvatarAnimationManifest);
  const clipKeys=new Set<string>();const payloadDigests=new Set<string>();let totalPayloadBytes=0;
  for(const clip of clips){
    if(clip.loop)throw new Error('Avatar emote pack clips must be finite non-looping gestures.');
    if(clip.durationMs>b.maxClipDurationMs)throw new Error(`Avatar emote clip ${clip.clipKey} exceeds the mobile duration budget.`);
    if(clip.payloadBytes>b.maxClipPayloadBytes)throw new Error(`Avatar emote clip ${clip.clipKey} exceeds the mobile payload budget.`);
    if(clipKeys.has(clip.clipKey))throw new Error(`Duplicate emote clip key ${clip.clipKey}.`);
    if(payloadDigests.has(clip.payloadSha256))throw new Error('Avatar emote pack cannot alias the same certified GLB payload under multiple clips.');
    clipKeys.add(clip.clipKey);payloadDigests.add(clip.payloadSha256);totalPayloadBytes+=clip.payloadBytes;
    if(totalPayloadBytes>b.maxPackPayloadBytes)throw new Error('Avatar emote pack exceeds the aggregate mobile payload budget.');
  }
  return {manifestVersion:AVATAR_EMOTE_PACK_MANIFEST_VERSION,packKey:input.packKey,clips,manifestSha256:input.manifestSha256.toLowerCase(),certifiedAt:input.certifiedAt};
}

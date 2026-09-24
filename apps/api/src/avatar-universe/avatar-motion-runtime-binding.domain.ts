import { AvatarAnimationManifest, AvatarAnimationKind, validateAvatarAnimationManifest } from './avatar-animation-manifest.domain';
import { AvatarEmotePackManifest, validateAvatarEmotePackManifest } from './avatar-emote-pack-manifest.domain';

export type AvatarMotionField = 'idleAnimation'|'signaturePose'|'greetingStyle'|'emotePackKey';
export type AvatarSingleClipMotionField = Exclude<AvatarMotionField,'emotePackKey'>;

/** Stable DNA keys are product identifiers, never proof that runtime art exists. */
export const AVATAR_MOTION_BINDINGS = Object.freeze({
  'idle-neutral-v1': Object.freeze({ field:'idleAnimation', clipKey:'knowme.idle.neutral.v1', allowedKinds:['BODY','COMBINED'] as readonly AvatarAnimationKind[] }),
  'pose-neutral-v1': Object.freeze({ field:'signaturePose', clipKey:'knowme.pose.neutral.v1', allowedKinds:['BODY','COMBINED'] as readonly AvatarAnimationKind[] }),
  'WAVE': Object.freeze({ field:'greetingStyle', clipKey:'knowme.greeting.wave.v1', allowedKinds:['BODY','COMBINED'] as readonly AvatarAnimationKind[] })
} as const);

/** Packs are intentionally separate from single clips: one pack must certify multiple gestures. */
export const AVATAR_EMOTE_PACK_BINDINGS = Object.freeze({
  'emotes-core-v1': Object.freeze({ field:'emotePackKey', packKey:'knowme.emotes.core.v1' })
} as const);

export type AvatarMotionKey = keyof typeof AVATAR_MOTION_BINDINGS;
export type AvatarEmotePackKey = keyof typeof AVATAR_EMOTE_PACK_BINDINGS;

export function isKnownAvatarMotionKey(field:AvatarMotionField,key:string):boolean {
  if(field==='emotePackKey')return Object.prototype.hasOwnProperty.call(AVATAR_EMOTE_PACK_BINDINGS,key);
  const binding=AVATAR_MOTION_BINDINGS[key as AvatarMotionKey];
  return !!binding&&binding.field===field;
}

/** Resolves one logical DNA motion only after its concrete GLB passed certification. */
export function bindCertifiedAvatarMotion(field:AvatarSingleClipMotionField,key:string,manifest:AvatarAnimationManifest):AvatarAnimationManifest {
  const binding=AVATAR_MOTION_BINDINGS[key as AvatarMotionKey];
  if(!binding||binding.field!==field) throw new Error(`Unknown avatar motion key ${key} for ${field}.`);
  const certified=validateAvatarAnimationManifest(manifest);
  if(certified.clipKey!==binding.clipKey) throw new Error(`Certified animation clip does not match avatar motion key ${key}.`);
  if(!(binding.allowedKinds as readonly string[]).includes(certified.kind)) throw new Error(`Certified animation kind is incompatible with avatar motion field ${field}.`);
  return certified;
}

/** Resolves an emote-pack DNA key only to a certified, bounded multi-clip pack. */
export function bindCertifiedAvatarEmotePack(key:string,manifest:AvatarEmotePackManifest):AvatarEmotePackManifest {
  const binding=AVATAR_EMOTE_PACK_BINDINGS[key as AvatarEmotePackKey];
  if(!binding)throw new Error(`Unknown avatar emote pack key ${key}.`);
  const certified=validateAvatarEmotePackManifest(manifest);
  if(certified.packKey!==binding.packKey)throw new Error(`Certified emote pack does not match avatar motion key ${key}.`);
  return certified;
}

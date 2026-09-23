import { AvatarAnimationManifest, AvatarAnimationKind, validateAvatarAnimationManifest } from './avatar-animation-manifest.domain';

export type AvatarMotionField = 'idleAnimation'|'signaturePose'|'greetingStyle'|'emotePackKey';

/**
 * Stable DNA keys are product-facing identifiers. They are not proof that a 3D
 * clip exists. A runtime binding becomes usable only after the referenced GLB
 * animation manifest has independently passed certification.
 */
export const AVATAR_MOTION_BINDINGS = Object.freeze({
  'idle-neutral-v1': Object.freeze({ field:'idleAnimation', clipKey:'knowme.idle.neutral.v1', allowedKinds:['BODY','COMBINED'] as readonly AvatarAnimationKind[] }),
  'pose-neutral-v1': Object.freeze({ field:'signaturePose', clipKey:'knowme.pose.neutral.v1', allowedKinds:['BODY','COMBINED'] as readonly AvatarAnimationKind[] }),
  'WAVE': Object.freeze({ field:'greetingStyle', clipKey:'knowme.greeting.wave.v1', allowedKinds:['BODY','COMBINED'] as readonly AvatarAnimationKind[] }),
  'emotes-core-v1': Object.freeze({ field:'emotePackKey', clipKey:'knowme.emotes.core.v1', allowedKinds:['BODY','FACIAL','COMBINED'] as readonly AvatarAnimationKind[] })
} as const);

export type AvatarMotionKey = keyof typeof AVATAR_MOTION_BINDINGS;

export function isKnownAvatarMotionKey(field:AvatarMotionField,key:string):boolean {
  const binding=AVATAR_MOTION_BINDINGS[key as AvatarMotionKey];
  return !!binding&&binding.field===field;
}

/**
 * Resolves a logical DNA motion only when immutable certification evidence and
 * rig/morph validation for its concrete GLB have succeeded. No URI, digest or
 * ownership hint from Avatar DNA participates in this decision.
 */
export function bindCertifiedAvatarMotion(field:AvatarMotionField,key:string,manifest:AvatarAnimationManifest):AvatarAnimationManifest {
  const binding=AVATAR_MOTION_BINDINGS[key as AvatarMotionKey];
  if(!binding||binding.field!==field) throw new Error(`Unknown avatar motion key ${key} for ${field}.`);
  const certified=validateAvatarAnimationManifest(manifest);
  if(certified.clipKey!==binding.clipKey) throw new Error(`Certified animation clip does not match avatar motion key ${key}.`);
  if(!(binding.allowedKinds as readonly string[]).includes(certified.kind)) throw new Error(`Certified animation kind is incompatible with avatar motion field ${field}.`);
  return certified;
}

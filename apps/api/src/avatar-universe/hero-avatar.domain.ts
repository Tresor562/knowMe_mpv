import {
  AVATAR_BODY_MORPHS,
  AVATAR_CANONICAL_FACIAL_RIG,
  AVATAR_CANONICAL_SKELETON,
  AVATAR_FACE_MORPHS,
  AvatarAssetManifest,
  validateAvatarAssetManifest,
} from './avatar-asset-manifest.domain';

export const HERO_AVATAR_CONTRACT_VERSION = 1 as const;
export const HERO_AVATAR_KEY = 'knowme.hero.v1' as const;

export const HERO_AVATAR_EXPRESSIONS = [
  'neutral', 'blinkLeft', 'blinkRight', 'jawOpen', 'smileLeft', 'smileRight',
  'frownLeft', 'frownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
  'mouthPucker', 'mouthFunnel', 'mouthClose', 'cheekPuff', 'noseSneerLeft', 'noseSneerRight',
] as const;

export const HERO_AVATAR_REQUIRED_VIEWS = [
  'front', 'threeQuarterLeft', 'threeQuarterRight', 'profileLeft', 'profileRight',
  'back', 'faceCloseup', 'eyeCloseup', 'hairCloseup', 'skinMaterialCloseup',
] as const;

export type HeroAvatarReferenceView = (typeof HERO_AVATAR_REQUIRED_VIEWS)[number];
export type HeroAvatarExpression = (typeof HERO_AVATAR_EXPRESSIONS)[number];

export type HeroAvatarProductionContract = {
  contractVersion: typeof HERO_AVATAR_CONTRACT_VERSION;
  heroKey: typeof HERO_AVATAR_KEY;
  baseBody: AvatarAssetManifest;
  referenceViews: Record<HeroAvatarReferenceView, string>;
  expressions: readonly HeroAvatarExpression[];
  skeletonKey: typeof AVATAR_CANONICAL_SKELETON;
  facialRigKey: typeof AVATAR_CANONICAL_FACIAL_RIG;
  scaleMeters: number;
  neutralPose: 'A_POSE';
  uvSets: 1;
  pbrWorkflow: 'METALLIC_ROUGHNESS';
  authoredInLinearColorSpace: true;
};

function assertSafeReferenceUri(uri: string, view: string) {
  if (typeof uri !== 'string' || !uri.startsWith('https://')) {
    throw new Error(`Hero Avatar reference ${view} must use https://.`);
  }
}

export function validateHeroAvatarProductionContract(input: HeroAvatarProductionContract) {
  if (input.contractVersion !== HERO_AVATAR_CONTRACT_VERSION || input.heroKey !== HERO_AVATAR_KEY) {
    throw new Error('Unsupported Hero Avatar production contract.');
  }
  if (input.skeletonKey !== AVATAR_CANONICAL_SKELETON || input.facialRigKey !== AVATAR_CANONICAL_FACIAL_RIG) {
    throw new Error('Hero Avatar must use the canonical body and facial rigs.');
  }
  if (input.neutralPose !== 'A_POSE' || input.uvSets !== 1 || input.pbrWorkflow !== 'METALLIC_ROUGHNESS' || input.authoredInLinearColorSpace !== true) {
    throw new Error('Hero Avatar authoring settings are incompatible with the runtime pipeline.');
  }
  if (!Number.isFinite(input.scaleMeters) || input.scaleMeters < 1.4 || input.scaleMeters > 2.1) {
    throw new Error('Hero Avatar scale must be expressed in realistic meters.');
  }
  const body = validateAvatarAssetManifest(input.baseBody);
  if (body.kind !== 'BASE_BODY') throw new Error('Hero Avatar baseBody must be a BASE_BODY asset.');
  if (body.skeletonKey !== input.skeletonKey || body.facialRigKey !== input.facialRigKey) {
    throw new Error('Hero Avatar base body rig metadata is inconsistent.');
  }
  for (const morph of [...AVATAR_BODY_MORPHS, ...AVATAR_FACE_MORPHS]) {
    if (!body.morphTargets.includes(morph)) throw new Error(`Hero Avatar is missing DNA morph ${morph}.`);
  }
  for (const expression of HERO_AVATAR_EXPRESSIONS) {
    if (!input.expressions.includes(expression)) throw new Error(`Hero Avatar is missing facial expression ${expression}.`);
  }
  for (const view of HERO_AVATAR_REQUIRED_VIEWS) assertSafeReferenceUri(input.referenceViews?.[view], view);
  return input;
}

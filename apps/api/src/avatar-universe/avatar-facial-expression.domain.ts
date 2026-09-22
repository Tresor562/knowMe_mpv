import { AVATAR_CANONICAL_FACIAL_RIG, AvatarAssetKind, AvatarAssetManifest } from './avatar-asset-manifest.domain';

export const AVATAR_FACIAL_EXPRESSION_CONTRACT_VERSION = 1 as const;

/**
 * Runtime expression blendshapes. These are intentionally separate from Avatar DNA identity morphs.
 * Names are KnowMe-owned runtime contracts, not client-provided metadata.
 */
export const AVATAR_EXPRESSION_BLENDSHAPES = [
  'blinkLeft', 'blinkRight', 'jawOpen', 'smileLeft', 'smileRight',
  'frownLeft', 'frownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
  'mouthPucker', 'mouthFunnel', 'mouthClose', 'cheekPuff', 'noseSneerLeft', 'noseSneerRight',
] as const;
export type AvatarExpressionBlendshape = (typeof AVATAR_EXPRESSION_BLENDSHAPES)[number];

const EXPRESSION_SET = new Set<string>(AVATAR_EXPRESSION_BLENDSHAPES);
const FACIAL_EXPRESSION_ASSET_KINDS = new Set<AvatarAssetKind>(['BASE_BODY', 'FACE']);

export type AvatarFacialExpressionContract = {
  contractVersion: typeof AVATAR_FACIAL_EXPRESSION_CONTRACT_VERSION;
  facialRigKey: typeof AVATAR_CANONICAL_FACIAL_RIG;
  blendshapes: readonly AvatarExpressionBlendshape[];
};

export function validateAvatarFacialExpressionContract(input: AvatarFacialExpressionContract) {
  if (input.contractVersion !== AVATAR_FACIAL_EXPRESSION_CONTRACT_VERSION) throw new Error('Unsupported avatar facial expression contract.');
  if (input.facialRigKey !== AVATAR_CANONICAL_FACIAL_RIG) throw new Error('Facial expressions must use the canonical KnowMe facial rig.');
  if (!Array.isArray(input.blendshapes)) throw new Error('Facial expression blendshapes are required.');
  if (new Set(input.blendshapes).size !== input.blendshapes.length) throw new Error('Duplicate facial expression blendshapes are not allowed.');
  for (const expression of AVATAR_EXPRESSION_BLENDSHAPES) if (!input.blendshapes.includes(expression)) throw new Error(`Facial rig is missing expression blendshape ${expression}.`);
  for (const expression of input.blendshapes) if (!EXPRESSION_SET.has(expression)) throw new Error(`Undeclared facial expression blendshape ${expression}.`);
  return input;
}

/** Prevent modular cosmetics from smuggling facial deformation contracts into runtime. */
export function assertAvatarAssetFacialMorphIsolation(asset: AvatarAssetManifest, expressionTargets: readonly string[] = []) {
  if (!FACIAL_EXPRESSION_ASSET_KINDS.has(asset.kind) && expressionTargets.length > 0) {
    throw new Error(`${asset.kind} assets cannot declare facial expression blendshapes.`);
  }
  if (expressionTargets.length > 0 && asset.facialRigKey !== AVATAR_CANONICAL_FACIAL_RIG) {
    throw new Error('Assets with facial expression blendshapes must use the canonical facial rig.');
  }
  for (const target of expressionTargets) if (!EXPRESSION_SET.has(target)) throw new Error(`Unknown facial expression blendshape ${target}.`);
  return true;
}

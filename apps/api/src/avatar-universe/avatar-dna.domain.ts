import {
  AVATAR_PERSONALITIES,
  AVATAR_RENDER_TIERS,
  AvatarMorphology,
  AvatarPersonalityProfile,
  AvatarRenderTier
} from './avatar-universe.domain';

export const AVATAR_DNA_SCHEMA_VERSION = 1 as const;
export const AVATAR_DNA_DEFAULT_KEYS = {
  baseMeshKey: 'knowme-human-v1',
  skeletonKey: 'knowme-humanoid-v1',
  facialRigKey: 'knowme-face-v1',
  materialProfileKey: 'knowme-pbr-skin-v1'
} as const;

export const AVATAR_MORPHOLOGY_KEYS = [
  'height', 'shoulderWidth', 'torsoLength', 'muscleDefinition', 'bodyMass',
  'headScale', 'jawWidth', 'cheekboneHeight', 'noseWidth', 'noseLength',
  'eyeSize', 'eyeSpacing', 'browHeight', 'lipFullness', 'earSize'
] as const satisfies readonly (keyof AvatarMorphology)[];

const PERSONALITY_NUMBER_KEYS = [
  'confidence', 'expressiveness', 'energy', 'warmth', 'humor', 'mystery'
] as const satisfies readonly (keyof AvatarPersonalityProfile)[];

function assertFiniteRange(name: string, value: unknown, min = 0, max = 100): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a finite number between ${min} and ${max}`);
  }
}

function assertSafeKey(name: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(value)) {
    throw new Error(`${name} is invalid`);
  }
}

export function validateAvatarMorphology(value: unknown): AvatarMorphology {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('morphology must be an object');
  const source = value as Record<string, unknown>;
  const allowed = new Set<string>(AVATAR_MORPHOLOGY_KEYS);
  for (const key of Object.keys(source)) if (!allowed.has(key)) throw new Error(`Unknown morphology control: ${key}`);
  const result = {} as AvatarMorphology;
  for (const key of AVATAR_MORPHOLOGY_KEYS) {
    assertFiniteRange(`morphology.${key}`, source[key]);
    result[key] = source[key] as number;
  }
  return result;
}

export function validateAvatarPersonality(value: unknown): AvatarPersonalityProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('personality must be an object');
  const source = value as Record<string, unknown>;
  if (!AVATAR_PERSONALITIES.includes(source.archetype as never)) throw new Error('personality.archetype is invalid');
  for (const key of PERSONALITY_NUMBER_KEYS) assertFiniteRange(`personality.${key}`, source[key]);
  for (const key of ['idleAnimation', 'signaturePose', 'greetingStyle', 'emotePackKey'] as const) assertSafeKey(`personality.${key}`, source[key]);
  return source as AvatarPersonalityProfile;
}

export function validateAvatarRenderTier(value: unknown): AvatarRenderTier {
  if (!AVATAR_RENDER_TIERS.includes(value as never)) throw new Error('renderTier is invalid');
  return value as AvatarRenderTier;
}

export type AvatarDNA = {
  schemaVersion: typeof AVATAR_DNA_SCHEMA_VERSION;
  revision: number;
  morphology: AvatarMorphology;
  personality: AvatarPersonalityProfile;
  renderTier: AvatarRenderTier;
  baseMeshKey: string;
  skeletonKey: string;
  facialRigKey: string;
  materialProfileKey: string;
};

export function validateAvatarDNA(value: unknown): AvatarDNA {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('avatar DNA must be an object');
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== AVATAR_DNA_SCHEMA_VERSION) throw new Error('Unsupported avatar DNA schema version');
  if (!Number.isSafeInteger(source.revision) || (source.revision as number) < 1) throw new Error('revision must be a positive safe integer');
  const baseMeshKey = source.baseMeshKey; const skeletonKey = source.skeletonKey;
  const facialRigKey = source.facialRigKey; const materialProfileKey = source.materialProfileKey;
  assertSafeKey('baseMeshKey', baseMeshKey); assertSafeKey('skeletonKey', skeletonKey);
  assertSafeKey('facialRigKey', facialRigKey); assertSafeKey('materialProfileKey', materialProfileKey);
  return {
    schemaVersion: AVATAR_DNA_SCHEMA_VERSION,
    revision: source.revision as number,
    morphology: validateAvatarMorphology(source.morphology),
    personality: validateAvatarPersonality(source.personality),
    renderTier: validateAvatarRenderTier(source.renderTier),
    baseMeshKey, skeletonKey, facialRigKey, materialProfileKey
  };
}

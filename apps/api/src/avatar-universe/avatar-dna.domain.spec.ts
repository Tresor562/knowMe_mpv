import {
  AVATAR_DNA_DEFAULT_KEYS,
  AVATAR_DNA_SCHEMA_VERSION,
  AVATAR_RUNTIME_MOTION_KEYS,
  validateAvatarDNA,
  validateAvatarMorphology,
  validateAvatarPersonality
} from './avatar-dna.domain';

const morphology = {
  height: 50, shoulderWidth: 50, torsoLength: 50, muscleDefinition: 50, bodyMass: 50,
  headScale: 50, jawWidth: 50, cheekboneHeight: 50, noseWidth: 50, noseLength: 50,
  eyeSize: 50, eyeSpacing: 50, browHeight: 50, lipFullness: 50, earSize: 50
};

const personality = {
  archetype: 'CONFIDENT' as const,
  confidence: 70, expressiveness: 55, energy: 60, warmth: 50, humor: 45, mystery: 30,
  idleAnimation: 'idle-neutral-v1', signaturePose: 'pose-neutral-v1',
  greetingStyle: 'WAVE', emotePackKey: 'emotes-core-v1'
};

const validDNA = () => ({
  schemaVersion: AVATAR_DNA_SCHEMA_VERSION,
  revision: 1,
  morphology,
  personality,
  renderTier: 'REALTIME_3D_BALANCED' as const,
  ...AVATAR_DNA_DEFAULT_KEYS
});

describe('Avatar DNA', () => {
  it('accepts a complete versioned server DNA payload', () => {
    expect(validateAvatarDNA(validDNA())).toMatchObject({ revision: 1, morphology, personality });
  });

  it('rejects out-of-range and non-finite morph values', () => {
    expect(() => validateAvatarMorphology({ ...morphology, jawWidth: 101 })).toThrow();
    expect(() => validateAvatarMorphology({ ...morphology, jawWidth: Number.NaN })).toThrow();
  });

  it('rejects unknown morphology controls so clients cannot smuggle runtime parameters', () => {
    expect(() => validateAvatarMorphology({ ...morphology, unlockPremiumMesh: 100 })).toThrow(
      'Unknown morphology control'
    );
  });

  it('rejects unknown top-level DNA fields instead of silently stripping client authority claims', () => {
    expect(() => validateAvatarDNA({ ...validDNA(), ownsPremium: true })).toThrow('Unknown avatar DNA field: ownsPremium');
    expect(() => validateAvatarDNA({ ...validDNA(), priceKnowCoins: 0 })).toThrow('Unknown avatar DNA field: priceKnowCoins');
  });

  it('rejects unknown personality fields that could smuggle unlock or animation authority', () => {
    expect(() => validateAvatarPersonality({ ...personality, premiumUnlocked: true })).toThrow('Unknown personality field: premiumUnlocked');
    expect(() => validateAvatarPersonality({ ...personality, animationUri: 'https://evil.invalid/a.glb' })).toThrow('Unknown personality field: animationUri');
  });

  it.each([
    ['idleAnimation', 'idle-client-upload-v999'],
    ['signaturePose', 'pose-premium-bypass-v1'],
    ['greetingStyle', 'greeting-unreviewed-v1'],
    ['emotePackKey', 'emotes-paid-without-entitlement-v1']
  ] as const)('rejects unregistered runtime personality key %s', (field, value) => {
    expect(() => validateAvatarPersonality({ ...personality, [field]: value })).toThrow(
      `personality.${field} is not a registered runtime motion key`
    );
  });

  it('registers only the runtime baseline that is currently evidenced by the default DNA', () => {
    expect(AVATAR_RUNTIME_MOTION_KEYS).toEqual({
      idleAnimation: ['idle-neutral-v1'],
      signaturePose: ['pose-neutral-v1'],
      greetingStyle: ['WAVE'],
      emotePackKey: ['emotes-core-v1']
    });
  });

  it('returns a canonical personality object containing only validated fields', () => {
    expect(validateAvatarPersonality(personality)).toEqual(personality);
  });

  it('rejects unsupported schema versions', () => {
    expect(() => validateAvatarDNA({ ...validDNA(), schemaVersion: 999 })).toThrow('Unsupported avatar DNA schema version');
  });
});

import {
  AVATAR_DNA_DEFAULT_KEYS,
  AVATAR_DNA_SCHEMA_VERSION,
  validateAvatarDNA,
  validateAvatarMorphology
} from './avatar-dna.domain';

const morphology = {
  height: 50, shoulderWidth: 50, torsoLength: 50, muscleDefinition: 50, bodyMass: 50,
  headScale: 50, jawWidth: 50, cheekboneHeight: 50, noseWidth: 50, noseLength: 50,
  eyeSize: 50, eyeSpacing: 50, browHeight: 50, lipFullness: 50, earSize: 50
};

const personality = {
  archetype: 'CONFIDENT' as const,
  confidence: 70, expressiveness: 55, energy: 60, warmth: 50, humor: 45, mystery: 30,
  idleAnimation: 'idle.confident.v1', signaturePose: 'pose.confident.v1',
  greetingStyle: 'greeting.confident.v1', emotePackKey: 'emotes.core.v1'
};

describe('Avatar DNA', () => {
  it('accepts a complete versioned server DNA payload', () => {
    expect(validateAvatarDNA({
      schemaVersion: AVATAR_DNA_SCHEMA_VERSION,
      revision: 1,
      morphology,
      personality,
      renderTier: 'REALTIME_3D_BALANCED',
      ...AVATAR_DNA_DEFAULT_KEYS
    })).toMatchObject({ revision: 1, morphology, personality });
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

  it('rejects unsupported schema versions', () => {
    expect(() => validateAvatarDNA({
      schemaVersion: 999, revision: 1, morphology, personality,
      renderTier: 'REALTIME_3D_BALANCED', ...AVATAR_DNA_DEFAULT_KEYS
    })).toThrow('Unsupported avatar DNA schema version');
  });
});

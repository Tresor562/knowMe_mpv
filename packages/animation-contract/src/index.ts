export type AnimationPreferenceMode = 'AUTO' | 'REDUCED' | 'OFF';
export type AnimationVariant = 'FULL' | 'REDUCED' | 'STATIC';
export type DeviceClass = 'LOW' | 'MID' | 'HIGH' | 'UNKNOWN';

export type AnimationEventDefinition = {
  key: string;
  category: string;
  assetKey: string;
  fallbackSymbol: string;
  fallbackLabel: string;
  maxDurationMs: number;
  supportsReduced: boolean;
  soundAllowed: boolean;
  hapticsAllowed: boolean;
  loadStrategy: 'LAZY';
};

export const ANIMATION_CATALOG_VERSION = 1;

export const ANIMATION_EVENTS = [
  {
    key: 'AUTH_LOGIN_SUCCESS',
    category: 'AUTH',
    assetKey: 'concept-k/login-success-v1',
    fallbackSymbol: '✓',
    fallbackLabel: 'Connexion réussie',
    maxDurationMs: 1200,
    supportsReduced: true,
    soundAllowed: false,
    hapticsAllowed: true,
    loadStrategy: 'LAZY'
  },
  {
    key: 'ACCOUNT_CREATED',
    category: 'AUTH',
    assetKey: 'concept-k/account-created-v1',
    fallbackSymbol: '★',
    fallbackLabel: 'Compte créé',
    maxDurationMs: 1600,
    supportsReduced: true,
    soundAllowed: true,
    hapticsAllowed: true,
    loadStrategy: 'LAZY'
  },
  {
    key: 'FRIEND_REQUEST_ACCEPTED',
    category: 'SOCIAL',
    assetKey: 'concept-k/friend-accepted-v1',
    fallbackSymbol: '🤝',
    fallbackLabel: 'Nouvelle amitié',
    maxDurationMs: 1400,
    supportsReduced: true,
    soundAllowed: false,
    hapticsAllowed: true,
    loadStrategy: 'LAZY'
  },
  {
    key: 'CHALLENGE_CREATED',
    category: 'CHALLENGE',
    assetKey: 'concept-k/challenge-created-v1',
    fallbackSymbol: '✦',
    fallbackLabel: 'Défi créé',
    maxDurationMs: 1200,
    supportsReduced: true,
    soundAllowed: false,
    hapticsAllowed: false,
    loadStrategy: 'LAZY'
  },
  {
    key: 'CHALLENGE_ANSWER_CORRECT',
    category: 'CHALLENGE',
    assetKey: 'concept-k/answer-correct-v1',
    fallbackSymbol: '✓',
    fallbackLabel: 'Bonne réponse',
    maxDurationMs: 700,
    supportsReduced: true,
    soundAllowed: true,
    hapticsAllowed: true,
    loadStrategy: 'LAZY'
  },
  {
    key: 'CHALLENGE_ANSWER_INCORRECT',
    category: 'CHALLENGE',
    assetKey: 'concept-k/answer-incorrect-v1',
    fallbackSymbol: '•',
    fallbackLabel: 'Réponse enregistrée',
    maxDurationMs: 600,
    supportsReduced: true,
    soundAllowed: false,
    hapticsAllowed: false,
    loadStrategy: 'LAZY'
  },
  {
    key: 'CHALLENGE_COMPLETED',
    category: 'CHALLENGE',
    assetKey: 'concept-k/challenge-completed-v1',
    fallbackSymbol: '🏁',
    fallbackLabel: 'Défi terminé',
    maxDurationMs: 1800,
    supportsReduced: true,
    soundAllowed: true,
    hapticsAllowed: true,
    loadStrategy: 'LAZY'
  },
  {
    key: 'LEVEL_UP',
    category: 'PROGRESSION',
    assetKey: 'concept-k/level-up-v1',
    fallbackSymbol: '↑',
    fallbackLabel: 'Niveau supérieur',
    maxDurationMs: 1800,
    supportsReduced: true,
    soundAllowed: true,
    hapticsAllowed: true,
    loadStrategy: 'LAZY'
  },
  {
    key: 'KNOWCOINS_RECEIVED',
    category: 'WALLET',
    assetKey: 'concept-k/knowcoins-received-v1',
    fallbackSymbol: '+',
    fallbackLabel: 'KnowCoins reçus',
    maxDurationMs: 1000,
    supportsReduced: true,
    soundAllowed: true,
    hapticsAllowed: true,
    loadStrategy: 'LAZY'
  },
  {
    key: 'MESSAGE_DELETED',
    category: 'MESSAGING',
    assetKey: 'concept-k/message-deleted-v1',
    fallbackSymbol: '×',
    fallbackLabel: 'Message supprimé',
    maxDurationMs: 500,
    supportsReduced: false,
    soundAllowed: false,
    hapticsAllowed: false,
    loadStrategy: 'LAZY'
  }
] as const satisfies readonly AnimationEventDefinition[];

export type AnimationEventKey = (typeof ANIMATION_EVENTS)[number]['key'];

export function findAnimationEvent(key: string): AnimationEventDefinition | null {
  return ANIMATION_EVENTS.find((event) => event.key === key) ?? null;
}

export function resolveAnimationPlan(input: {
  eventKey: string;
  preferenceMode: AnimationPreferenceMode;
  clientReducedMotion: boolean;
  deviceClass: DeviceClass;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}) {
  const event = findAnimationEvent(input.eventKey);
  if (!event) return null;

  let variant: AnimationVariant = 'FULL';
  let reason = 'AUTO_FULL';

  if (input.preferenceMode === 'OFF') {
    variant = 'STATIC';
    reason = 'USER_DISABLED';
  } else if (input.preferenceMode === 'REDUCED' || input.clientReducedMotion) {
    variant = event.supportsReduced ? 'REDUCED' : 'STATIC';
    reason = input.clientReducedMotion ? 'SYSTEM_REDUCED_MOTION' : 'USER_REDUCED';
  } else if (input.deviceClass === 'LOW') {
    variant = event.supportsReduced ? 'REDUCED' : 'STATIC';
    reason = 'LOW_END_DEVICE';
  }

  return {
    catalogVersion: ANIMATION_CATALOG_VERSION,
    event,
    variant,
    reason,
    shouldAnimate: variant !== 'STATIC',
    soundEnabled: variant === 'FULL' && input.soundEnabled && event.soundAllowed,
    hapticsEnabled: variant !== 'STATIC' && input.hapticsEnabled && event.hapticsAllowed,
    blocking: false,
    skippable: true
  };
}

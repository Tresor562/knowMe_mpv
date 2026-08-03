export const PROFILE_STAT_OPERATIONS = [
  'INCREMENT',
  'SET_MAX',
  'SET_VALUE'
] as const;
export type ProfileStatOperation =
  (typeof PROFILE_STAT_OPERATIONS)[number];

export const PROFILE_STAT_DEFINITIONS = {
  level: { visibility: 'PUBLIC', operations: ['SET_MAX'], minimum: 1, maximum: 1_000 },
  xp: { visibility: 'PUBLIC', operations: ['INCREMENT'], minimum: 0, maximum: 1_000_000 },
  challengesCreated: { visibility: 'PUBLIC', operations: ['INCREMENT'], minimum: 0, maximum: 10_000 },
  challengesWon: { visibility: 'PUBLIC', operations: ['INCREMENT'], minimum: 0, maximum: 10_000 },
  averageAffinityBps: { visibility: 'PUBLIC', operations: ['SET_VALUE'], minimum: 0, maximum: 10_000 },
  quizzesCreated: { visibility: 'PUBLIC', operations: ['INCREMENT'], minimum: 0, maximum: 10_000 },
  quizzesCompleted: { visibility: 'PUBLIC', operations: ['INCREMENT'], minimum: 0, maximum: 10_000 },
  gamesWon: { visibility: 'PUBLIC', operations: ['INCREMENT'], minimum: 0, maximum: 10_000 },
  friends: { visibility: 'PUBLIC', operations: ['SET_VALUE'], minimum: 0, maximum: 100_000_000 },
  followers: { visibility: 'PUBLIC', operations: ['SET_VALUE'], minimum: 0, maximum: 100_000_000 },
  following: { visibility: 'PUBLIC', operations: ['SET_VALUE'], minimum: 0, maximum: 100_000_000 },
  dailyStreak: { visibility: 'PUBLIC', operations: ['SET_MAX', 'SET_VALUE'], minimum: 0, maximum: 100_000 },
  giftsReceived: { visibility: 'PUBLIC', operations: ['INCREMENT'], minimum: 0, maximum: 10_000 },
  giftsSent: { visibility: 'PUBLIC', operations: ['INCREMENT'], minimum: 0, maximum: 10_000 },
  messagesSent: { visibility: 'PRIVATE', operations: ['INCREMENT'], minimum: 0, maximum: 1_000_000 },
  knowCoinsEarned: { visibility: 'PRIVATE', operations: ['INCREMENT'], minimum: 0, maximum: 1_000_000_000 },
  knowCoinsSpent: { visibility: 'PRIVATE', operations: ['INCREMENT'], minimum: 0, maximum: 1_000_000_000 },
  activeMinutes: { visibility: 'PRIVATE', operations: ['INCREMENT'], minimum: 0, maximum: 1_000_000 }
} as const;

export type ProfileStatKey = keyof typeof PROFILE_STAT_DEFINITIONS;

export function validateProfileStatEvent(input: {
  key: string;
  operation: ProfileStatOperation;
  numericValue: number;
  idempotencyKey: string;
}) {
  const definition = PROFILE_STAT_DEFINITIONS[input.key as ProfileStatKey];
  if (!definition) throw new Error('Statistique de profil inconnue.');
  if (!PROFILE_STAT_OPERATIONS.includes(input.operation)) {
    throw new Error('Opération statistique inconnue.');
  }
  if (!(definition.operations as readonly string[]).includes(input.operation)) {
    throw new Error('Opération interdite pour cette statistique.');
  }
  if (!Number.isInteger(input.numericValue)) {
    throw new Error('La valeur statistique doit être entière.');
  }
  if (
    input.numericValue < definition.minimum ||
    input.numericValue > definition.maximum
  ) {
    throw new Error('Valeur statistique hors limites.');
  }
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 180) {
    throw new Error('Clé d’idempotence statistique invalide.');
  }
  return definition;
}

export function applyProfileStatEvent(
  metrics: Record<string, number>,
  input: {
    key: ProfileStatKey;
    operation: ProfileStatOperation;
    numericValue: number;
  }
) {
  const current = Number.isFinite(metrics[input.key])
    ? metrics[input.key]
    : 0;
  let next = input.numericValue;
  if (input.operation === 'INCREMENT') next = current + input.numericValue;
  if (input.operation === 'SET_MAX') next = Math.max(current, input.numericValue);
  return { ...metrics, [input.key]: next };
}

export function profileStatPrivacyPolicy() {
  const publicKeys = Object.entries(PROFILE_STAT_DEFINITIONS)
    .filter(([, definition]) => definition.visibility === 'PUBLIC')
    .map(([key]) => key);
  const privateKeys = Object.entries(PROFILE_STAT_DEFINITIONS)
    .filter(([, definition]) => definition.visibility === 'PRIVATE')
    .map(([key]) => key);
  return {
    publicKeys,
    privateKeys,
    unknownKeysPrivateByDefault: true,
    walletBalanceTrackedHere: false,
    walletBalancePubliclyExposed: false,
    privateUsageMetricsPubliclyExposed: false
  } as const;
}

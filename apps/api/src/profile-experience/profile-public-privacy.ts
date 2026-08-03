export const PUBLIC_PROFILE_STAT_KEYS = [
  'level',
  'xp',
  'challengesCreated',
  'challengesWon',
  'averageAffinityBps',
  'quizzesCreated',
  'quizzesCompleted',
  'gamesWon',
  'friends',
  'followers',
  'following',
  'dailyStreak',
  'giftsReceived',
  'giftsSent'
] as const;

export const PRIVATE_PROFILE_FIELD_KEYS = new Set([
  'knowCoins',
  'knowCoinsBalance',
  'knowCoinsEarned',
  'knowCoinsSpent',
  'walletBalance',
  'availableBalance',
  'lockedBalance',
  'lifetimeCredits',
  'lifetimeDebits',
  'creatorRevenue',
  'estimatedRevenue',
  'payoutBalance',
  'messagesSent',
  'activeMinutes',
  'timeSpentMinutes',
  'timeSpentSeconds'
]);

type PublicProfileSnapshot = {
  viewer?: { owner?: boolean } | null;
  privacy?: Record<string, unknown> | null;
  statistics?: unknown;
  [key: string]: unknown;
};

export function sanitizePublicProfileStatistics(
  metrics: unknown,
  owner: boolean
): Record<string, unknown> | null {
  if (metrics === null || metrics === undefined) return null;
  if (!isRecord(metrics)) return {};
  if (owner) return { ...metrics };

  const result: Record<string, unknown> = {};
  for (const key of PUBLIC_PROFILE_STAT_KEYS) {
    const value = metrics[key];
    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      !PRIVATE_PROFILE_FIELD_KEYS.has(key)
    ) {
      result[key] = value;
    }
  }
  return result;
}

export function sanitizePublicProfileSnapshot<T extends PublicProfileSnapshot>(
  snapshot: T
): T {
  const owner = snapshot.viewer?.owner === true;
  if (owner) return snapshot;

  const scrubbed = deepStripPrivateFields(snapshot) as T;
  const statistics = sanitizePublicProfileStatistics(scrubbed.statistics, false);

  return {
    ...scrubbed,
    statistics,
    privacy: {
      ...(isRecord(scrubbed.privacy) ? scrubbed.privacy : {}),
      financialDataOmitted: true,
      unknownStatisticsPrivateByDefault: true,
      publicStatisticsAllowlisted: true
    }
  };
}

function deepStripPrivateFields(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(deepStripPrivateFields);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_PROFILE_FIELD_KEYS.has(key))
      .map(([key, entry]) => [key, deepStripPrivateFields(entry)])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

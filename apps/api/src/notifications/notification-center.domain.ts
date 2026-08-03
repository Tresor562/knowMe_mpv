export const NOTIFICATION_CATEGORIES = [
  'SOCIAL',
  'MESSAGING',
  'CHALLENGES',
  'GIFTS',
  'SECRET',
  'CIRCLES',
  'SECURITY',
  'SYSTEM'
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationDigestMode = 'INSTANT' | 'HOURLY' | 'DAILY' | 'OFF';

export type NotificationPreferencePolicy = {
  masterEnabled: boolean;
  realtimeEnabled: boolean;
  pushEnabled: boolean;
  digestMode: NotificationDigestMode;
  quietHoursEnabled: boolean;
  quietStartMinute: number;
  quietEndMinute: number;
  timezone: string;
  categorySettings: Record<NotificationCategory, boolean>;
  mutedTypes: string[];
  mutedCircleIds: string[];
};

const CRITICAL_CATEGORIES = new Set<NotificationCategory>(['SECURITY', 'SYSTEM']);

export function defaultCategorySettings(): Record<NotificationCategory, boolean> {
  return {
    SOCIAL: true,
    MESSAGING: true,
    CHALLENGES: true,
    GIFTS: true,
    SECRET: true,
    CIRCLES: true,
    SECURITY: true,
    SYSTEM: true
  };
}

export function defaultNotificationPreference(): NotificationPreferencePolicy {
  return {
    masterEnabled: true,
    realtimeEnabled: true,
    pushEnabled: false,
    digestMode: 'INSTANT',
    quietHoursEnabled: false,
    quietStartMinute: 22 * 60,
    quietEndMinute: 7 * 60,
    timezone: 'UTC',
    categorySettings: defaultCategorySettings(),
    mutedTypes: [],
    mutedCircleIds: []
  };
}

export function classifyNotificationType(type: string): NotificationCategory {
  const normalized = type.trim().toUpperCase();
  if (normalized.startsWith('SECURITY_') || normalized.includes('CAPTURE')) return 'SECURITY';
  if (normalized.startsWith('SYSTEM_') || normalized.startsWith('ACCOUNT_')) return 'SYSTEM';
  if (normalized.startsWith('MESSAGE') || normalized.startsWith('CALL_')) return 'MESSAGING';
  if (normalized.startsWith('CHALLENGE_') || normalized.startsWith('GAME_') || normalized.startsWith('QUIZ_')) return 'CHALLENGES';
  if (normalized.startsWith('GIFT_') || normalized.includes('KNOWCOIN_REWARD')) return 'GIFTS';
  if (normalized.startsWith('SECRET_')) return 'SECRET';
  if (normalized.startsWith('CIRCLE_') || normalized.startsWith('PROFILE_CIRCLE_') || normalized.startsWith('FAMILY_') || normalized.startsWith('GUILD_') || normalized.startsWith('DUO_')) return 'CIRCLES';
  return 'SOCIAL';
}

export function isQuietMinute(minuteOfDay: number, startMinute: number, endMinute: number) {
  for (const value of [minuteOfDay, startMinute, endMinute]) {
    if (!Number.isInteger(value) || value < 0 || value > 1439) {
      throw new Error('Minute de journée invalide.');
    }
  }
  if (startMinute === endMinute) return true;
  if (startMinute < endMinute) {
    return minuteOfDay >= startMinute && minuteOfDay < endMinute;
  }
  return minuteOfDay >= startMinute || minuteOfDay < endMinute;
}

export function resolveNotificationDelivery(input: {
  type: string;
  circleId?: string | null;
  minuteOfDay: number;
  preference: NotificationPreferencePolicy;
}) {
  const category = classifyNotificationType(input.type);
  const critical = CRITICAL_CATEGORIES.has(category);
  const categoryEnabled = input.preference.categorySettings[category] !== false;
  const typeMuted = input.preference.mutedTypes.includes(input.type);
  const circleMuted = Boolean(input.circleId && input.preference.mutedCircleIds.includes(input.circleId));
  const visibleInCenter = critical || (
    input.preference.masterEnabled && categoryEnabled && !typeMuted && !circleMuted
  );
  const quiet = input.preference.quietHoursEnabled && isQuietMinute(
    input.minuteOfDay,
    input.preference.quietStartMinute,
    input.preference.quietEndMinute
  );
  const instant = input.preference.digestMode === 'INSTANT';
  return {
    category,
    critical,
    visibleInCenter,
    realtime: visibleInCenter && input.preference.realtimeEnabled && instant && !quiet,
    push: visibleInCenter && input.preference.pushEnabled && instant && !quiet,
    digest: visibleInCenter && !critical && ['HOURLY', 'DAILY'].includes(input.preference.digestMode),
    quiet,
    reason: !visibleInCenter
      ? circleMuted
        ? 'CIRCLE_MUTED'
        : typeMuted
          ? 'TYPE_MUTED'
          : !categoryEnabled
            ? 'CATEGORY_DISABLED'
            : 'MASTER_DISABLED'
      : quiet
        ? 'QUIET_HOURS'
        : instant
          ? 'INSTANT'
          : `DIGEST_${input.preference.digestMode}`
  } as const;
}

export function normalizeStringList(value: unknown, maximum = 200) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean))].slice(0, maximum);
}

export function normalizeCategorySettings(value: unknown) {
  const defaults = defaultCategorySettings();
  if (!value || Array.isArray(value) || typeof value !== 'object') return defaults;
  const record = value as Record<string, unknown>;
  for (const category of NOTIFICATION_CATEGORIES) {
    if (typeof record[category] === 'boolean') defaults[category] = record[category] as boolean;
  }
  defaults.SECURITY = true;
  defaults.SYSTEM = true;
  return defaults;
}

export type NotificationCenterRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
};

function jsonRecord(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {} as Record<string, unknown>;
  return value as Record<string, unknown>;
}

export function groupNotificationRows(rows: NotificationCenterRow[]) {
  const groups = new Map<string, NotificationCenterRow[]>();
  for (const row of rows) {
    const data = jsonRecord(row.data);
    const collective = data.collectiveNotification === true;
    const explicitGroupKey = typeof data.groupKey === 'string' ? data.groupKey : null;
    const circleId = typeof data.circleId === 'string' ? data.circleId : null;
    const hourBucket = Math.floor(row.createdAt.getTime() / 3_600_000);
    const key = explicitGroupKey
      ? `${explicitGroupKey}:${hourBucket}`
      : collective && circleId
        ? `circle:${circleId}:${row.type}:${hourBucket}`
        : `single:${row.id}`;
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([groupKey, items]) => {
      const sorted = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const latest = sorted[0];
      const latestData = jsonRecord(latest.data);
      return {
        groupKey,
        category: classifyNotificationType(latest.type),
        count: sorted.length,
        unreadCount: sorted.filter((item) => !item.readAt).length,
        latest,
        notificationIds: sorted.map((item) => item.id),
        route: typeof latestData.route === 'string' ? latestData.route : null,
        grouped: sorted.length > 1
      };
    })
    .sort((a, b) => b.latest.createdAt.getTime() - a.latest.createdAt.getTime());
}

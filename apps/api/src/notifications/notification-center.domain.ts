export const NOTIFICATION_CENTER_CATEGORIES = [
  'SOCIAL',
  'MESSAGING',
  'CHALLENGES',
  'GIFTS',
  'SECRET',
  'CIRCLES',
  'SECURITY',
  'SYSTEM'
] as const;

export type NotificationCenterCategory =
  (typeof NOTIFICATION_CENTER_CATEGORIES)[number];
export type NotificationCenterDigestMode =
  | 'INSTANT'
  | 'HOURLY'
  | 'DAILY'
  | 'CENTER_ONLY';
export type NotificationCenterView =
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'SNOOZED'
  | 'DISMISSED';

export type NotificationCenterPreferencePolicy = {
  masterEnabled: boolean;
  realtimeEnabled: boolean;
  digestMode: NotificationCenterDigestMode;
  dailyDigestMinute: number;
  quietHoursEnabled: boolean;
  quietStartMinute: number;
  quietEndMinute: number;
  timezone: string;
  categorySettings: Record<NotificationCenterCategory, boolean>;
  mutedTypes: string[];
  mutedCircleIds: string[];
};

const CRITICAL_CATEGORIES = new Set<NotificationCenterCategory>([
  'SECURITY',
  'SYSTEM'
]);

export function defaultNotificationCenterCategories(): Record<
  NotificationCenterCategory,
  boolean
> {
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

export function defaultNotificationCenterPreference(): NotificationCenterPreferencePolicy {
  return {
    masterEnabled: true,
    realtimeEnabled: true,
    digestMode: 'INSTANT',
    dailyDigestMinute: 8 * 60,
    quietHoursEnabled: false,
    quietStartMinute: 22 * 60,
    quietEndMinute: 7 * 60,
    timezone: 'UTC',
    categorySettings: defaultNotificationCenterCategories(),
    mutedTypes: [],
    mutedCircleIds: []
  };
}

export function classifyNotificationType(
  type: string
): NotificationCenterCategory {
  const normalized = type.trim().toUpperCase();
  if (
    normalized.startsWith('SECURITY_') ||
    normalized.includes('CAPTURE') ||
    normalized.includes('LOGIN') ||
    normalized.includes('PASSWORD') ||
    normalized.includes('TWO_FACTOR') ||
    normalized.includes('DEVICE_')
  ) {
    return 'SECURITY';
  }
  if (
    normalized.startsWith('SYSTEM_') ||
    normalized.startsWith('ACCOUNT_') ||
    normalized.startsWith('PAYMENT_') ||
    normalized.startsWith('BILLING_') ||
    normalized.startsWith('VERIFICATION_') ||
    normalized === 'NOTIFICATION_DIGEST'
  ) {
    return 'SYSTEM';
  }
  if (
    normalized.startsWith('MESSAGE') ||
    normalized.startsWith('CALL_') ||
    normalized.startsWith('TYPING_')
  ) {
    return 'MESSAGING';
  }
  if (
    normalized.startsWith('CHALLENGE_') ||
    normalized.startsWith('GAME_') ||
    normalized.startsWith('QUIZ_') ||
    normalized.startsWith('TOURNAMENT_')
  ) {
    return 'CHALLENGES';
  }
  if (
    normalized.startsWith('GIFT_') ||
    normalized.includes('KNOWCOIN_REWARD') ||
    normalized.startsWith('REWARD_')
  ) {
    return 'GIFTS';
  }
  if (normalized.startsWith('SECRET_')) return 'SECRET';
  if (
    normalized.startsWith('CIRCLE_') ||
    normalized.startsWith('PROFILE_CIRCLE_') ||
    normalized.startsWith('FAMILY_') ||
    normalized.startsWith('GUILD_') ||
    normalized.startsWith('DUO_') ||
    normalized.startsWith('COMMUNITY_')
  ) {
    return 'CIRCLES';
  }
  return 'SOCIAL';
}

export function isCriticalNotificationType(type: string) {
  return CRITICAL_CATEGORIES.has(classifyNotificationType(type));
}

export function isQuietMinute(
  minuteOfDay: number,
  startMinute: number,
  endMinute: number
) {
  for (const value of [minuteOfDay, startMinute, endMinute]) {
    if (!Number.isInteger(value) || value < 0 || value > 1439) {
      throw new Error('NOTIFICATION_CENTER_MINUTE_INVALID');
    }
  }
  if (startMinute === endMinute) return true;
  return startMinute < endMinute
    ? minuteOfDay >= startMinute && minuteOfDay < endMinute
    : minuteOfDay >= startMinute || minuteOfDay < endMinute;
}

export function normalizeNotificationStringList(
  value: unknown,
  maximum = 200
) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean)
  )].slice(0, maximum);
}

export function normalizeNotificationCategories(value: unknown) {
  const result = defaultNotificationCenterCategories();
  if (value && !Array.isArray(value) && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const category of NOTIFICATION_CENTER_CATEGORIES) {
      if (typeof record[category] === 'boolean') {
        result[category] = record[category];
      }
    }
  }
  result.SECURITY = true;
  result.SYSTEM = true;
  return result;
}

export function notificationDataRecord(value: unknown) {
  return value && !Array.isArray(value) && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function notificationCircleId(data: unknown) {
  const record = notificationDataRecord(data);
  return typeof record.circleId === 'string' ? record.circleId : null;
}

export function resolveNotificationCenterDelivery(input: {
  type: string;
  circleId?: string | null;
  minuteOfDay: number;
  preference: NotificationCenterPreferencePolicy;
}) {
  const category = classifyNotificationType(input.type);
  const critical = CRITICAL_CATEGORIES.has(category);
  const categoryEnabled = input.preference.categorySettings[category] !== false;
  const typeMuted = input.preference.mutedTypes.includes(input.type);
  const circleMuted = Boolean(
    input.circleId && input.preference.mutedCircleIds.includes(input.circleId)
  );
  const visibleInCenter =
    critical ||
    (input.preference.masterEnabled &&
      categoryEnabled &&
      !typeMuted &&
      !circleMuted);
  const quiet =
    !critical &&
    input.preference.quietHoursEnabled &&
    isQuietMinute(
      input.minuteOfDay,
      input.preference.quietStartMinute,
      input.preference.quietEndMinute
    );
  const realtime =
    visibleInCenter &&
    (critical ||
      (input.preference.realtimeEnabled &&
        input.preference.digestMode === 'INSTANT' &&
        !quiet));
  const digest =
    visibleInCenter &&
    !critical &&
    (input.preference.digestMode === 'HOURLY' ||
      input.preference.digestMode === 'DAILY');

  return {
    category,
    critical,
    visibleInCenter,
    realtime,
    digest,
    digestMode: digest ? input.preference.digestMode : null,
    quiet,
    reason: !visibleInCenter
      ? circleMuted
        ? 'CIRCLE_MUTED'
        : typeMuted
          ? 'TYPE_MUTED'
          : !categoryEnabled
            ? 'CATEGORY_DISABLED'
            : 'MASTER_DISABLED'
      : critical
        ? 'CRITICAL'
        : quiet
          ? 'QUIET_HOURS'
          : input.preference.digestMode
  } as const;
}

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function localDateParts(now: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const number = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? NaN);
  const result = {
    year: number('year'),
    month: number('month'),
    day: number('day'),
    hour: number('hour'),
    minute: number('minute')
  };
  if (Object.values(result).some((value) => !Number.isFinite(value))) {
    throw new Error('NOTIFICATION_CENTER_TIMEZONE_INVALID');
  }
  return result;
}

export function localMinuteOfDay(now: Date, timezone: string) {
  const parts = localDateParts(now, timezone);
  return parts.hour * 60 + parts.minute;
}

function timezoneOffsetMs(instant: Date, timezone: string) {
  const parts = localDateParts(instant, timezone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  );
  return localAsUtc - Math.floor(instant.getTime() / 60_000) * 60_000;
}

function localDateTimeToUtc(input: LocalParts, timezone: string) {
  const wallClock = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute
  );
  let candidate = new Date(wallClock);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    candidate = new Date(wallClock - timezoneOffsetMs(candidate, timezone));
  }
  return candidate;
}

function localDateKey(parts: LocalParts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day
  ).padStart(2, '0')}`;
}

export function notificationDigestSchedule(input: {
  mode: 'HOURLY' | 'DAILY';
  now: Date;
  timezone: string;
  dailyDigestMinute: number;
}) {
  const local = localDateParts(input.now, input.timezone);
  if (input.mode === 'HOURLY') {
    const nextWallClock = new Date(
      Date.UTC(local.year, local.month - 1, local.day, local.hour + 1, 0)
    );
    const normalized: LocalParts = {
      year: nextWallClock.getUTCFullYear(),
      month: nextWallClock.getUTCMonth() + 1,
      day: nextWallClock.getUTCDate(),
      hour: nextWallClock.getUTCHours(),
      minute: 0
    };
    return {
      bucketKey: `HOURLY:${localDateKey(local)}:${String(local.hour).padStart(
        2,
        '0'
      )}`,
      dueAt: localDateTimeToUtc(normalized, input.timezone)
    };
  }

  if (
    !Number.isInteger(input.dailyDigestMinute) ||
    input.dailyDigestMinute < 0 ||
    input.dailyDigestMinute > 1439
  ) {
    throw new Error('NOTIFICATION_CENTER_DAILY_MINUTE_INVALID');
  }
  const targetHour = Math.floor(input.dailyDigestMinute / 60);
  const targetMinute = input.dailyDigestMinute % 60;
  let target: LocalParts = {
    ...local,
    hour: targetHour,
    minute: targetMinute
  };
  let dueAt = localDateTimeToUtc(target, input.timezone);
  if (dueAt.getTime() <= input.now.getTime()) {
    const tomorrow = new Date(
      Date.UTC(local.year, local.month - 1, local.day + 1, targetHour, targetMinute)
    );
    target = {
      year: tomorrow.getUTCFullYear(),
      month: tomorrow.getUTCMonth() + 1,
      day: tomorrow.getUTCDate(),
      hour: targetHour,
      minute: targetMinute
    };
    dueAt = localDateTimeToUtc(target, input.timezone);
  }
  return {
    bucketKey: `DAILY:${localDateKey(local)}`,
    dueAt
  };
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

export function groupNotificationCenterRows(rows: NotificationCenterRow[]) {
  const groups = new Map<string, NotificationCenterRow[]>();
  for (const row of rows) {
    const data = notificationDataRecord(row.data);
    const collective = data.collectiveNotification === true;
    const explicit = typeof data.groupKey === 'string' ? data.groupKey : null;
    const circleId = typeof data.circleId === 'string' ? data.circleId : null;
    const hourBucket = Math.floor(row.createdAt.getTime() / 3_600_000);
    const key = explicit
      ? `explicit:${explicit}:${hourBucket}`
      : collective && circleId
        ? `circle:${circleId}:${row.type}:${hourBucket}`
        : `single:${row.id}`;
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([groupKey, values]) => {
      const items = [...values].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      );
      const latest = items[0];
      const data = notificationDataRecord(latest.data);
      return {
        groupKey,
        category: classifyNotificationType(latest.type),
        count: items.length,
        unreadCount: items.filter((item) => !item.readAt).length,
        latest,
        notificationIds: items.map((item) => item.id),
        route: typeof data.route === 'string' ? data.route : null,
        grouped: items.length > 1
      };
    })
    .sort(
      (left, right) =>
        right.latest.createdAt.getTime() - left.latest.createdAt.getTime()
    );
}

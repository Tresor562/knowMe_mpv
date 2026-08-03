import {
  isMandatoryCircleNotification,
  ProfileCircleNotificationPreferenceSnapshot,
  resolveCircleNotificationPreference
} from './profile-circle-notification-preferences.domain';
import { ProfileCircleNotificationType } from './profile-circle-notifications.domain';

export type ProfileCircleNotificationSchedulePreference =
  ProfileCircleNotificationPreferenceSnapshot & {
    quietHoursEnabled: boolean;
    quietStartMinute: number;
    quietEndMinute: number;
    timezone: string;
    digestMode: 'OFF' | 'DAILY';
    digestMinuteOfDay: number;
  };

export type ProfileCircleNotificationDeliveryDecision = {
  inboxAllowed: boolean;
  realtimeAllowed: boolean;
  mandatory: boolean;
  category: string;
  muted: boolean;
  deliveryMode: 'INSTANT' | 'AFTER_QUIET_HOURS' | 'DAILY_DIGEST';
  availableAt: Date;
  quietHoursActive: boolean;
};

export function validateNotificationSchedulePreference(input: {
  quietStartMinute: number;
  quietEndMinute: number;
  digestMinuteOfDay: number;
  timezone: string;
}) {
  for (const [label, value] of [
    ['début silencieux', input.quietStartMinute],
    ['fin silencieuse', input.quietEndMinute],
    ['heure du résumé', input.digestMinuteOfDay]
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 1439) {
      throw new Error(`Minute invalide pour ${label}.`);
    }
  }
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: input.timezone }).format(
      new Date()
    );
  } catch {
    throw new Error('Fuseau horaire invalide.');
  }
  return true;
}

export function resolveNotificationDeliverySchedule(input: {
  type: ProfileCircleNotificationType;
  circleId?: string | null;
  preference: ProfileCircleNotificationSchedulePreference;
  now?: Date;
}): ProfileCircleNotificationDeliveryDecision {
  validateNotificationSchedulePreference(input.preference);
  const now = input.now ?? new Date();
  const base = resolveCircleNotificationPreference({
    type: input.type,
    circleId: input.circleId,
    preference: input.preference
  });
  if (!base.inboxAllowed) {
    return {
      ...base,
      deliveryMode: 'INSTANT',
      availableAt: now,
      quietHoursActive: false
    };
  }

  const mandatory = isMandatoryCircleNotification(input.type);
  const quietHoursActive =
    input.preference.quietHoursEnabled &&
    isMinuteInQuietWindow(
      localMinuteOfDay(now, input.preference.timezone),
      input.preference.quietStartMinute,
      input.preference.quietEndMinute
    );

  if (!mandatory && input.preference.digestMode === 'DAILY') {
    const availableAt = nextLocalMinuteOccurrence({
      now,
      timezone: input.preference.timezone,
      targetMinute: input.preference.digestMinuteOfDay,
      strictlyFuture: true
    });
    return {
      ...base,
      realtimeAllowed: false,
      deliveryMode: 'DAILY_DIGEST',
      availableAt,
      quietHoursActive
    };
  }

  if (!mandatory && quietHoursActive) {
    const availableAt = nextQuietWindowEnd({
      now,
      timezone: input.preference.timezone,
      quietStartMinute: input.preference.quietStartMinute,
      quietEndMinute: input.preference.quietEndMinute
    });
    return {
      ...base,
      realtimeAllowed: false,
      deliveryMode: 'AFTER_QUIET_HOURS',
      availableAt,
      quietHoursActive: true
    };
  }

  return {
    ...base,
    realtimeAllowed: base.realtimeAllowed && !quietHoursActive,
    deliveryMode: 'INSTANT',
    availableAt: now,
    quietHoursActive
  };
}

export function isMinuteInQuietWindow(
  minute: number,
  startMinute: number,
  endMinute: number
) {
  if (startMinute === endMinute) return true;
  if (startMinute < endMinute) {
    return minute >= startMinute && minute < endMinute;
  }
  return minute >= startMinute || minute < endMinute;
}

export function localMinuteOfDay(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function nextQuietWindowEnd(input: {
  now: Date;
  timezone: string;
  quietStartMinute: number;
  quietEndMinute: number;
}) {
  return findNextMinute(input.now, (candidate) => {
    const minute = localMinuteOfDay(candidate, input.timezone);
    return !isMinuteInQuietWindow(
      minute,
      input.quietStartMinute,
      input.quietEndMinute
    );
  });
}

export function nextLocalMinuteOccurrence(input: {
  now: Date;
  timezone: string;
  targetMinute: number;
  strictlyFuture: boolean;
}) {
  return findNextMinute(
    input.strictlyFuture
      ? new Date(input.now.getTime() + 60_000)
      : input.now,
    (candidate) => localMinuteOfDay(candidate, input.timezone) === input.targetMinute
  );
}

function findNextMinute(start: Date, predicate: (candidate: Date) => boolean) {
  const rounded = new Date(start);
  rounded.setUTCSeconds(0, 0);
  for (let offset = 0; offset <= 3 * 24 * 60; offset += 1) {
    const candidate = new Date(rounded.getTime() + offset * 60_000);
    if (predicate(candidate)) return candidate;
  }
  throw new Error('Impossible de calculer la prochaine fenêtre de notification.');
}

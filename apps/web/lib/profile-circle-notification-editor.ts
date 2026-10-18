export type ProfileCircleNotificationPreference = {
  enabled: boolean;
  invitationsEnabled: boolean;
  membershipEnabled: boolean;
  governanceEnabled: boolean;
  contentEnabled: boolean;
  familyEnabled: boolean;
  realtimeEnabled: boolean;
  mutedCircleIds: string[];
  quietHoursEnabled: boolean;
  quietStartMinute: number;
  quietEndMinute: number;
  timezone: string;
  digestMode: 'OFF' | 'DAILY';
  digestMinuteOfDay: number;
};

export const DEFAULT_CIRCLE_NOTIFICATION_PREFERENCE: ProfileCircleNotificationPreference = {
  enabled: true, invitationsEnabled: true, membershipEnabled: true,
  governanceEnabled: true, contentEnabled: true, familyEnabled: true,
  realtimeEnabled: true, mutedCircleIds: [],
  quietHoursEnabled: false, quietStartMinute: 22 * 60,
  quietEndMinute: 7 * 60, timezone: 'UTC',
  digestMode: 'OFF', digestMinuteOfDay: 8 * 60
};

export function minuteToClock(minute: number): string {
  if (!Number.isInteger(minute) || minute < 0 || minute >= 1440) return '';
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function clockToMinute(clock: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function profileCirclePreferenceError(
  preference: ProfileCircleNotificationPreference
): 'time' | 'timezone' | 'digest' | 'muted' | null {
  if (![preference.quietStartMinute, preference.quietEndMinute, preference.digestMinuteOfDay]
    .every(n => Number.isInteger(n) && n >= 0 && n < 1440)) return 'time';
  if (!preference.timezone.trim() || preference.timezone.length > 80) return 'timezone';
  try {
    new Intl.DateTimeFormat('en-US', {timeZone: preference.timezone.trim()});
  } catch { return 'timezone'; }
  if (!['OFF', 'DAILY'].includes(preference.digestMode)) return 'digest';
  if (!Array.isArray(preference.mutedCircleIds) ||
    preference.mutedCircleIds.length > 500 ||
    preference.mutedCircleIds.some(id => typeof id !== 'string' || id.length > 160 || !id.trim()))
    return 'muted';
  return null;
}

/** Explicitly constructs all mandatory API fields; no partial PUTs. */
export function profileCirclePreferencePayload(preference: ProfileCircleNotificationPreference) {
  const problem = profileCirclePreferenceError(preference);
  if (problem) throw new Error(`CIRCLE_NOTIFICATION_INVALID_${problem.toUpperCase()}`);
  return {
    ...preference,
    timezone: preference.timezone.trim(),
    mutedCircleIds: [...new Set(preference.mutedCircleIds.map(id => id.trim()))]
  };
}

export function toggleCircleMuted(
  preference: ProfileCircleNotificationPreference, circleId: string
): ProfileCircleNotificationPreference {
  const ids = new Set(preference.mutedCircleIds);
  if (ids.has(circleId)) ids.delete(circleId);
  else ids.add(circleId);
  return { ...preference, mutedCircleIds: [...ids] };
}

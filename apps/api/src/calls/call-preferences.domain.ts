export type CallPreference = {
  incomingCallsEnabled: boolean;
  allowAudioCalls: boolean;
  allowVideoCalls: boolean;
  quietHoursEnabled: boolean;
  quietStartMinute: number;
  quietEndMinute: number;
  timezone: string;
  microphoneEnabledByDefault: boolean;
  cameraEnabledByDefault: boolean;
  devicePreviewRequired: boolean;
};

export const DEFAULT_CALL_PREFERENCE: CallPreference = {
  incomingCallsEnabled: true,
  allowAudioCalls: true,
  allowVideoCalls: true,
  quietHoursEnabled: false,
  quietStartMinute: 22 * 60,
  quietEndMinute: 7 * 60,
  timezone: 'UTC',
  microphoneEnabledByDefault: true,
  cameraEnabledByDefault: true,
  devicePreviewRequired: true
};

export function normalizeCallPreference(
  value: Partial<CallPreference>
): CallPreference {
  return {
    incomingCallsEnabled:
      value.incomingCallsEnabled ??
      DEFAULT_CALL_PREFERENCE.incomingCallsEnabled,
    allowAudioCalls:
      value.allowAudioCalls ?? DEFAULT_CALL_PREFERENCE.allowAudioCalls,
    allowVideoCalls:
      value.allowVideoCalls ?? DEFAULT_CALL_PREFERENCE.allowVideoCalls,
    quietHoursEnabled:
      value.quietHoursEnabled ?? DEFAULT_CALL_PREFERENCE.quietHoursEnabled,
    quietStartMinute:
      value.quietStartMinute ?? DEFAULT_CALL_PREFERENCE.quietStartMinute,
    quietEndMinute:
      value.quietEndMinute ?? DEFAULT_CALL_PREFERENCE.quietEndMinute,
    timezone: value.timezone ?? DEFAULT_CALL_PREFERENCE.timezone,
    microphoneEnabledByDefault:
      value.microphoneEnabledByDefault ??
      DEFAULT_CALL_PREFERENCE.microphoneEnabledByDefault,
    cameraEnabledByDefault:
      value.cameraEnabledByDefault ??
      DEFAULT_CALL_PREFERENCE.cameraEnabledByDefault,
    devicePreviewRequired:
      value.devicePreviewRequired ??
      DEFAULT_CALL_PREFERENCE.devicePreviewRequired
  };
}

export function minuteInTimezone(at: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new RangeError(`Unable to resolve local time for ${timezone}`);
  }
  return hour * 60 + minute;
}

export function isQuietAt(preference: CallPreference, at: Date) {
  if (!preference.quietHoursEnabled) return false;
  const currentMinute = minuteInTimezone(at, preference.timezone);
  const { quietStartMinute: start, quietEndMinute: end } = preference;
  if (start === end) return true;
  return start < end
    ? currentMinute >= start && currentMinute < end
    : currentMinute >= start || currentMinute < end;
}

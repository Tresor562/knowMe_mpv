export type CallMedia = 'audio' | 'video';

export type CallPreferenceFields = {
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

export type CallPreferenceUpdate = CallPreferenceFields & {
  expectedVersion: number;
};

export type CallPreferenceView = CallPreferenceFields & {
  userId: string;
  version: number;
  persisted: boolean;
  updatedAt: string | null;
};

export type MobileMediaPermission = {
  granted: boolean;
  canAskAgain: boolean;
};

export function buildCallPreferenceUpdate(
  preference: CallPreferenceFields,
  expectedVersion: number
): CallPreferenceUpdate {
  return {
    incomingCallsEnabled: preference.incomingCallsEnabled,
    allowAudioCalls: preference.allowAudioCalls,
    allowVideoCalls: preference.allowVideoCalls,
    quietHoursEnabled: preference.quietHoursEnabled,
    quietStartMinute: preference.quietStartMinute,
    quietEndMinute: preference.quietEndMinute,
    timezone: preference.timezone,
    microphoneEnabledByDefault: preference.microphoneEnabledByDefault,
    cameraEnabledByDefault: preference.cameraEnabledByDefault,
    devicePreviewRequired: preference.devicePreviewRequired,
    expectedVersion
  };
}

export function minuteToTime(value: number) {
  const bounded = Math.max(0, Math.min(1439, Math.trunc(value)));
  return `${String(Math.floor(bounded / 60)).padStart(2, '0')}:${String(
    bounded % 60
  ).padStart(2, '0')}`;
}

export function parseTimeToMinute(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function permissionLabel(permission: MobileMediaPermission | null) {
  if (!permission) return 'Vérification en cours';
  if (permission.granted) return 'Autorisée';
  return permission.canAskAgain ? 'À demander' : 'Refusée dans les réglages';
}

export function isMobilePreparationReady(
  media: CallMedia,
  microphonePermission: MobileMediaPermission | null,
  cameraPermission: MobileMediaPermission | null,
  cameraPreviewReady: boolean
) {
  if (!microphonePermission?.granted) return false;
  if (media === 'audio') return true;
  return Boolean(cameraPermission?.granted && cameraPreviewReady);
}

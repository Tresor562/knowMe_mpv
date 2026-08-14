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

export type BrowserMediaPermission =
  PermissionState | 'unknown' | 'unsupported';

export type MediaPreparationState =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'missing-device'
  | 'device-busy'
  | 'unsupported-constraint'
  | 'unsupported'
  | 'error';

export type MediaPreparationFailure =
  | 'denied'
  | 'missing-device'
  | 'device-busy'
  | 'unsupported-constraint'
  | 'unknown';

export function minuteToTime(value: number) {
  const bounded = Math.max(0, Math.min(1439, Math.trunc(value)));
  return `${String(Math.floor(bounded / 60)).padStart(2, '0')}:${String(
    bounded % 60,
  ).padStart(2, '0')}`;
}

export function timeToMinute(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return 0;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return 0;
  return hour * 60 + minute;
}

export function buildCallPreferenceUpdate(
  preference: CallPreferenceFields,
  expectedVersion: number,
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
    expectedVersion,
  };
}

export function buildMediaConstraints(
  media: CallMedia,
  microphoneId: string,
  cameraId: string,
): MediaStreamConstraints {
  return {
    audio: microphoneId ? { deviceId: { exact: microphoneId } } : true,
    video:
      media === 'video'
        ? cameraId
          ? { deviceId: { exact: cameraId } }
          : true
        : false,
  };
}

export function isCallMediaPrepared(
  preparedMedia: CallMedia | null,
  requestedMedia: CallMedia,
  previewRequired: boolean,
) {
  return (
    !previewRequired ||
    preparedMedia === 'video' ||
    preparedMedia === requestedMedia
  );
}

export function classifyMediaPreparationFailure(
  cause: unknown,
): MediaPreparationFailure {
  const name =
    cause && typeof cause === 'object' && 'name' in cause
      ? String(cause.name)
      : '';

  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError') return 'missing-device';
  if (name === 'NotReadableError' || name === 'AbortError')
    return 'device-busy';
  if (name === 'OverconstrainedError') return 'unsupported-constraint';
  return 'unknown';
}

export function mediaPreparationFailureMessage(
  failure: MediaPreparationFailure,
) {
  switch (failure) {
    case 'denied':
      return 'Permission refusée. Autorise le microphone ou la caméra dans le navigateur, puis réessaie.';
    case 'missing-device':
      return 'Aucun appareil compatible n’a été trouvé.';
    case 'device-busy':
      return 'Un appareil est déjà utilisé ou momentanément indisponible.';
    case 'unsupported-constraint':
      return 'L’appareil choisi n’est plus disponible. Sélectionne-en un autre.';
    default:
      return 'La préparation locale a échoué. Vérifie les appareils puis réessaie.';
  }
}

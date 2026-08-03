export const MEDIA_KINDS = ['IMAGE', 'VIDEO', 'AUDIO', 'FILE'] as const;
export const NETWORK_CLASSES = ['WIFI', 'CELLULAR', 'ROAMING', 'OFFLINE', 'UNKNOWN'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export type NetworkClass = (typeof NETWORK_CLASSES)[number];

export type MediaDownloadPreference = {
  wifiKinds: MediaKind[];
  cellularKinds: MediaKind[];
  roamingKinds: MediaKind[];
  backgroundDownloads: boolean;
  respectDataSaver: boolean;
  maxCacheMb: number;
};

export type MediaDownloadDecision = {
  allowed: boolean;
  reason:
    | 'ALLOWED'
    | 'OFFLINE'
    | 'UNKNOWN_NETWORK'
    | 'DATA_SAVER'
    | 'BACKGROUND_DISABLED'
    | 'KIND_DISABLED'
    | 'CACHE_LIMIT';
  previewOnly: boolean;
};

export const DEFAULT_MEDIA_DOWNLOAD_PREFERENCE: Readonly<MediaDownloadPreference> = {
  wifiKinds: [...MEDIA_KINDS],
  cellularKinds: ['IMAGE'],
  roamingKinds: [],
  backgroundDownloads: false,
  respectDataSaver: true,
  maxCacheMb: 512
};

export function normalizeKinds(value: unknown): MediaKind[] {
  if (!Array.isArray(value)) return [];
  return MEDIA_KINDS.filter((kind) => value.includes(kind));
}

export function normalizeMediaDownloadPreference(
  value: Partial<MediaDownloadPreference> | null | undefined
): MediaDownloadPreference {
  const maxCacheMb = Number(value?.maxCacheMb);
  return {
    wifiKinds: value?.wifiKinds ? normalizeKinds(value.wifiKinds) : [...DEFAULT_MEDIA_DOWNLOAD_PREFERENCE.wifiKinds],
    cellularKinds: value?.cellularKinds ? normalizeKinds(value.cellularKinds) : [...DEFAULT_MEDIA_DOWNLOAD_PREFERENCE.cellularKinds],
    roamingKinds: value?.roamingKinds ? normalizeKinds(value.roamingKinds) : [...DEFAULT_MEDIA_DOWNLOAD_PREFERENCE.roamingKinds],
    backgroundDownloads: value?.backgroundDownloads ?? DEFAULT_MEDIA_DOWNLOAD_PREFERENCE.backgroundDownloads,
    respectDataSaver: value?.respectDataSaver ?? DEFAULT_MEDIA_DOWNLOAD_PREFERENCE.respectDataSaver,
    maxCacheMb: Number.isFinite(maxCacheMb)
      ? Math.min(4096, Math.max(64, Math.round(maxCacheMb)))
      : DEFAULT_MEDIA_DOWNLOAD_PREFERENCE.maxCacheMb
  };
}

export function decideMediaDownload(input: {
  preference: MediaDownloadPreference;
  kind: MediaKind;
  network: NetworkClass;
  isBackground?: boolean;
  dataSaverEnabled?: boolean;
  cachedBytes?: number;
  incomingBytes?: number;
}): MediaDownloadDecision {
  if (input.network === 'OFFLINE') return deny('OFFLINE');
  if (input.network === 'UNKNOWN') return deny('UNKNOWN_NETWORK');
  if (input.preference.respectDataSaver && input.dataSaverEnabled) return deny('DATA_SAVER');
  if (input.isBackground && !input.preference.backgroundDownloads) {
    return deny('BACKGROUND_DISABLED');
  }

  const enabledKinds = input.network === 'WIFI'
    ? input.preference.wifiKinds
    : input.network === 'ROAMING'
      ? input.preference.roamingKinds
      : input.preference.cellularKinds;
  if (!enabledKinds.includes(input.kind)) return deny('KIND_DISABLED');

  const limitBytes = input.preference.maxCacheMb * 1024 * 1024;
  const nextBytes = Math.max(0, input.cachedBytes ?? 0) + Math.max(0, input.incomingBytes ?? 0);
  if (nextBytes > limitBytes) return deny('CACHE_LIMIT');
  return { allowed: true, reason: 'ALLOWED', previewOnly: false };
}

export function mediaKindFromMime(mimeType: string | null | undefined): MediaKind {
  const value = String(mimeType ?? '').toLowerCase();
  if (value.startsWith('image/')) return 'IMAGE';
  if (value.startsWith('video/')) return 'VIDEO';
  if (value.startsWith('audio/')) return 'AUDIO';
  return 'FILE';
}

export function cacheLimitBytes(maxCacheMb: number) {
  return normalizeMediaDownloadPreference({ maxCacheMb }).maxCacheMb * 1024 * 1024;
}

function deny(reason: Exclude<MediaDownloadDecision['reason'], 'ALLOWED'>): MediaDownloadDecision {
  return { allowed: false, reason, previewOnly: true };
}

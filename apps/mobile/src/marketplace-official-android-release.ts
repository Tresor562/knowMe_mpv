export type MarketplaceOfficialAndroidRelease = {
  version: string;
  versionCode: number;
  url: string;
  sha256: string;
  notes: string;
  required: boolean;
};

// Read-only mirror of the existing self-hosted Android update authority.
export function marketplaceOfficialAndroidRelease(feed: unknown): MarketplaceOfficialAndroidRelease | null {
  if (!feed || typeof feed !== 'object' || Array.isArray(feed)) return null;
  const raw = (feed as { release?: unknown }).release;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const version = data.version;
  const versionCode = data.versionCode;
  const sha256 = data.sha256;
  const url = data.url;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version) ||
    !Number.isSafeInteger(versionCode) || Number(versionCode) < 1 ||
    typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sha256) ||
    typeof url !== 'string') return null;
  // Never accept an APK from an untrusted host. This is the same self-hosted
  // origin used by KnowMe's native update watcher.
  const requiredUrl = 'https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android/apk/' +
    'KnowMe-' + version + '-preview.apk';
  if (url !== requiredUrl) return null;
  return {
    version,
    versionCode: Number(versionCode),
    sha256: sha256.toLowerCase(),
    url,
    notes: typeof data.notes === 'string' ? data.notes.slice(0, 500) : '',
    required: data.required === true
  };
}

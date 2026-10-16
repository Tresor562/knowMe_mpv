/**
 * Expo Updates protocol v1 feed for KnowMe's own signed Android distribution.
 * Serves only immutable GitHub-release assets from the canonical repository.
 * A release is never selected for another native runtime/channel/platform.
 */
export const KNOWME_OTA_RUNTIME = 'knowme-android-sdk53-native7';
const RELEASES_URL = 'https://api.github.com/repos/Tresor562/knowMe_mpv/releases?per_page=30';
const RELEASE_ROOT = 'https://github.com/Tresor562/knowMe_mpv/releases/download/';
const TAG_PREFIX = 'knowme-ota-preview-native7-';
const CACHE_DURATION_MS = 60_000;

type Asset = {
  key: string;
  hash: string;
  contentType: string;
  fileExtension?: string;
  url: string;
};
export type ExpoManifest = {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: Asset;
  assets: Asset[];
  metadata: Record<string, string>;
  extra: Record<string, unknown>;
};

type GithubRelease = {
  draft?: boolean;
  prerelease?: boolean;
  tag_name?: string;
  assets?: Array<{ name?: string; browser_download_url?: string }>;
};

let cached: ExpoManifest | null = null;
let nextFetch = 0;
let fetching: Promise<ExpoManifest | null> | null = null;

function allowedAsset(asset: unknown, prefix: string): asset is Asset {
  if (!asset || typeof asset !== 'object') return false;
  const value = asset as Record<string, unknown>;
  return typeof value.key === 'string' &&
    /^[a-zA-Z0-9._-]{1,256}$/.test(value.key) &&
    typeof value.hash === 'string' &&
    /^[a-zA-Z0-9_-]{43}$/.test(value.hash) &&
    typeof value.contentType === 'string' &&
    /^(?:application\/|image\/|font\/|audio\/|video\/)/.test(value.contentType) &&
    typeof value.url === 'string' &&
    value.url.startsWith(prefix) &&
    !value.url.includes('?') && !value.url.includes('#') &&
    /^https:\/\/github\.com\/Tresor562\/knowMe_mpv\/releases\/download\/[^/]+\/[^/]+$/.test(value.url);
}

export function isValidKnowMeExpoManifest(
  input: unknown,
  releaseTag: string
): input is ExpoManifest {
  if (!input || typeof input !== 'object') return false;
  const manifest = input as Partial<ExpoManifest>;
  const prefix = RELEASE_ROOT + releaseTag + '/';
  if (!manifest.id || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(manifest.id) ||
      !manifest.createdAt || !Number.isFinite(Date.parse(manifest.createdAt)) ||
      manifest.runtimeVersion !== KNOWME_OTA_RUNTIME ||
      manifest.metadata?.channel !== 'preview' ||
      manifest.metadata?.platform !== 'android' ||
      !allowedAsset(manifest.launchAsset, prefix) ||
      !Array.isArray(manifest.assets) || manifest.assets.length > 500 ||
      !manifest.assets.every(asset => allowedAsset(asset, prefix)) ||
      !manifest.extra || typeof manifest.extra !== 'object') return false;
  return true;
}

async function fetchUpdateManifest(): Promise<ExpoManifest | null> {
  if (Date.now() < nextFetch) return cached;
  if (fetching) return fetching;
  fetching = (async () => {
    nextFetch = Date.now() + CACHE_DURATION_MS;
    try {
      const response = await fetch(RELEASES_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'KnowMe-Expo-OTA-Feed'
        },
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) return cached;
      const releases = await response.json() as GithubRelease[];
      if (!Array.isArray(releases)) return cached;
      for (const release of releases) {
        if (release.draft || !release.prerelease ||
            !release.tag_name?.startsWith(TAG_PREFIX)) continue;
        const asset = release.assets?.find(item =>
          item.name === 'expo-ota-manifest.json' &&
          item.browser_download_url ===
            RELEASE_ROOT + release.tag_name + '/expo-ota-manifest.json'
        );
        if (!asset?.browser_download_url) continue;
        const manifestResponse = await fetch(asset.browser_download_url, {
          signal: AbortSignal.timeout(5000)
        });
        if (!manifestResponse.ok) continue;
        const raw = await manifestResponse.text();
        if (raw.length > 256_000) continue;
        const parsed: unknown = JSON.parse(raw);
        if (!isValidKnowMeExpoManifest(parsed, release.tag_name)) continue;
        cached = parsed;
        return cached;
      }
      cached = null;
    } catch {
      // If GitHub is temporarily unavailable, keep serving the last trusted
      // release instead of switching users to an unverified manifest.
    }
    return cached;
  })();
  try {
    return await fetching;
  } finally {
    fetching = null;
  }
}

export async function getKnowMeExpoUpdate(
  headers: Record<string, string | string[] | undefined>
): Promise<{ status: 200 | 204 | 400; manifest?: ExpoManifest }> {
  if (headers['expo-protocol-version'] !== '1') return { status: 400 };
  if (headers['expo-platform'] !== 'android') return { status: 204 };
  if (headers['expo-runtime-version'] !== KNOWME_OTA_RUNTIME) return { status: 204 };
  // Only the vetted Android preview channel may receive previews.
  if (headers['expo-channel-name'] !== 'preview') return { status: 204 };
  if (process.env.KNOWME_EXPO_OTA_ENABLED !== 'true') return { status: 204 };
  const manifest = await fetchUpdateManifest();
  return manifest ? { status: 200, manifest } : { status: 204 };
}

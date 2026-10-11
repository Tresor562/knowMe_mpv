import { Controller, Get, Header } from '@nestjs/common';

export type AndroidReleaseNotice = {
  versionCode: number;
  version: string;
  url: string;
  sha256: string;
  notes: string;
  required: boolean;
};

// Fail closed: an incomplete release cannot cause installation.
export function readAndroidReleaseNotice(env: NodeJS.ProcessEnv): AndroidReleaseNotice | null {
  const versionCode = Number(env.KNOWME_ANDROID_UPDATE_VERSION_CODE);
  const version = env.KNOWME_ANDROID_UPDATE_VERSION?.trim() ?? '';
  const rawUrl = env.KNOWME_ANDROID_UPDATE_URL?.trim() ?? '';
  const sha256 = env.KNOWME_ANDROID_UPDATE_SHA256?.trim().toLowerCase() ?? '';
  if (!Number.isSafeInteger(versionCode) || versionCode < 1) return null;
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) return null;
  if (!/^[a-f0-9]{64}$/.test(sha256)) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const trustedGithubRelease = host === 'github.com'
    && url.pathname.startsWith('/Tresor562/knowMe_mpv/releases/download/')
    && url.pathname.toLowerCase().endsWith('.apk');
  const customHost = env.KNOWME_ANDROID_UPDATE_ALLOWED_HOST?.trim().toLowerCase();
  const trustedSelfHost = Boolean(customHost && host === customHost && url.pathname.endsWith('.apk'));
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    (!trustedGithubRelease && !trustedSelfHost)
  ) {
    return null;
  }

  return {
    versionCode,
    version,
    url: url.toString(),
    sha256,
    notes: (env.KNOWME_ANDROID_UPDATE_NOTES?.trim() ||
      'Une nouvelle version de KnowMe est disponible.').slice(0, 500),
    required: env.KNOWME_ANDROID_UPDATE_REQUIRED === 'true'
  };
}

const OFFICIAL_RELEASES_API =
  'https://api.github.com/repos/Tresor562/knowMe_mpv/releases?per_page=8';
const RELEASE_CACHE_MS = 15 * 60 * 1000;
let nextReleaseCheckAt = 0;
let cachedRelease: AndroidReleaseNotice | null = null;

type GitHubRelease = {
  draft?: boolean;
  assets?: Array<{ name?: string; browser_download_url?: string }>;
};

async function discoverPublishedAndroidRelease(): Promise<AndroidReleaseNotice | null> {
  if (Date.now() < nextReleaseCheckAt) return cachedRelease;
  // This endpoint can be requested by many phones: throttle external discovery.
  nextReleaseCheckAt = Date.now() + RELEASE_CACHE_MS;
  try {
    const response = await fetch(OFFICIAL_RELEASES_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'KnowMe-Android-Release-Feed'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return cachedRelease;
    const releases = await response.json() as GitHubRelease[];
    if (!Array.isArray(releases)) return cachedRelease;

    let newest: AndroidReleaseNotice | null = null;
    for (const release of releases) {
      if (release.draft || !Array.isArray(release.assets)) continue;
      const manifest = release.assets.find((asset) =>
        asset.name === 'knowme-update.json' &&
        typeof asset.browser_download_url === 'string' &&
        asset.browser_download_url.startsWith(
          'https://github.com/Tresor562/knowMe_mpv/releases/download/'
        )
      );
      if (!manifest?.browser_download_url) continue;
      const manifestResponse = await fetch(manifest.browser_download_url, {
        signal: AbortSignal.timeout(5000)
      });
      if (!manifestResponse.ok) continue;
      const rawText = await manifestResponse.text();
      if (rawText.length > 4096) continue;
      const data = JSON.parse(rawText) as Record<string, unknown>;
      const candidate = readAndroidReleaseNotice({
        KNOWME_ANDROID_UPDATE_VERSION_CODE: String(data.versionCode ?? ''),
        KNOWME_ANDROID_UPDATE_VERSION: String(data.version ?? ''),
        KNOWME_ANDROID_UPDATE_URL: String(data.url ?? ''),
        KNOWME_ANDROID_UPDATE_SHA256: String(data.sha256 ?? ''),
        KNOWME_ANDROID_UPDATE_NOTES: typeof data.notes === 'string' ? data.notes : '',
        KNOWME_ANDROID_UPDATE_REQUIRED: data.required === true ? 'true' : 'false'
      });
      if (candidate && (!newest || candidate.versionCode > newest.versionCode)) {
        newest = candidate;
      }
    }
    cachedRelease = newest;
  } catch {
    // Retain the last known-good metadata while GitHub is unavailable.
  }
  return cachedRelease;
}

@Controller('mobile-updates')
export class MobileUpdatesController {
  @Get('android')
  @Header('Cache-Control', 'no-store')
  async getAndroidUpdate() {
    const locallyConfigured = readAndroidReleaseNotice(process.env);
    if (locallyConfigured) return { release: locallyConfigured };

    // Partial/invalid manual configuration is not silently overridden.
    const manuallyConfigured = Boolean(
      process.env.KNOWME_ANDROID_UPDATE_URL ||
      process.env.KNOWME_ANDROID_UPDATE_SHA256 ||
      process.env.KNOWME_ANDROID_UPDATE_VERSION_CODE
    );
    if (manuallyConfigured || process.env.KNOWME_ANDROID_AUTO_DISCOVER_GITHUB === 'false') {
      return { release: null };
    }
    return { release: await discoverPublishedAndroidRelease() };
  }
}

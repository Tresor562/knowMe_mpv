import { Controller, Get, Header, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common';
import { openHostedAndroidApk, readHostedAndroidRelease } from './self-hosted-android-update';

type ApkResponse = { setHeader(name: string, value: string): void };

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
// The VPS broadcasts new releases to online clients after discovery.
// A short cache bounds GitHub load while keeping alerts reasonably timely.
const RELEASE_CACHE_MS = 2 * 60 * 1000;
let nextReleaseCheckAt = 0;
let cachedRelease: AndroidReleaseNotice | null = null;

type GitHubRelease = {
  draft?: boolean;
  prerelease?: boolean;
  tag_name?: string;
  assets?: Array<{ name?: string; browser_download_url?: string; size?: number }>;
};

/** An existing production signing channel must never be replaced with a
 * debug-signed preview release. GitHub preview discovery only upgrades preview
 * installations; Android still checks the APK signature itself. */
export function chooseAndroidRelease(
  configured: AndroidReleaseNotice | null,
  discovered: AndroidReleaseNotice | null
): AndroidReleaseNotice | null {
  if (!configured) return discovered;
  if (!/\/releases\/download\/v\d+\.\d+\.\d+-preview\//.test(configured.url)) {
    return configured;
  }
  if (
    discovered &&
    /\/releases\/download\/v\d+\.\d+\.\d+-preview\//.test(discovered.url) &&
    discovered.versionCode > configured.versionCode
  ) {
    return discovered;
  }
  return configured;
}

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
      if (
        release.draft || release.prerelease !== true ||
        !/^v\d+\.\d+\.\d+-preview$/.test(release.tag_name ?? '') ||
        !Array.isArray(release.assets)
      ) continue;
      const prefix = `https://github.com/Tresor562/knowMe_mpv/releases/download/${release.tag_name}/`;
      const manifest = release.assets.find((asset) =>
        asset.name === 'knowme-update.json' &&
        asset.browser_download_url === `${prefix}knowme-update.json`
      );
      if (!manifest?.browser_download_url) continue;
      try {
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
        if (!candidate || release.tag_name !== `v${candidate.version}-preview`) continue;
        const apkAsset = release.assets.find((asset) =>
          asset.name === `KnowMe-${candidate.version}-preview.apk` &&
          asset.browser_download_url === candidate.url &&
          (asset.size ?? 0) > 10_000_000
        );
        const checksumAsset = release.assets.find((asset) =>
          asset.name === `KnowMe-${candidate.version}-preview.apk.sha256` &&
          asset.browser_download_url === `${prefix}KnowMe-${candidate.version}-preview.apk.sha256`
        );
        if (!apkAsset || !checksumAsset) continue;
        if (!newest || candidate.versionCode > newest.versionCode) {
          newest = candidate;
        }
      } catch {
        // A broken release must not prevent evaluating the other releases.
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
  // Stable, browser-friendly recovery route for users whose older native
  // updater cannot complete. Only stream the APK already qualified by the
  // VPS mirror (signed preview certificate, validated manifest and filesize).
  // This URL never points to an arbitrary client-supplied download address.
  @Get('android/download')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('X-Content-Type-Options', 'nosniff')
  downloadLatestHostedApk(@Res({ passthrough: true }) response: ApkResponse) {
    const release = readHostedAndroidRelease();
    if (!release) throw new NotFoundException('Mise à jour Android officielle indisponible.');
    // Recheck the underlying binary immediately before opening the stream.
    const apk = openHostedAndroidApk(release.filename);
    if (!apk) throw new NotFoundException('APK KnowMe indisponible.');
    response.setHeader('Content-Length', String(apk.size));
    return new StreamableFile(apk.stream, {
      type: 'application/vnd.android.package-archive',
      disposition: 'attachment; filename="' + apk.filename + '"',
      length: apk.size
    });
  }

  @Get('android/apk/:filename')
  @Header('Cache-Control', 'public, max-age=3600, immutable')
  getHostedApk(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) response: ApkResponse
  ) {
    const apk = openHostedAndroidApk(filename);
    if (!apk) throw new NotFoundException('APK KnowMe indisponible.');
    response.setHeader('Content-Length', String(apk.size));
    return new StreamableFile(apk.stream, {
      type: 'application/vnd.android.package-archive',
      disposition: 'attachment; filename="' + apk.filename + '"',
      length: apk.size
    });
  }

  @Get('android')
  @Header('Cache-Control', 'no-store')
  async getAndroidUpdate() {
    // New releases on the KnowMe VPS take priority over legacy GitHub
    // preview pins. Once VPS-only mode is active, never consult GitHub.
    const hosted = readHostedAndroidRelease();
    if (hosted) {
      const { filename, size, ...release } = hosted;
      return { release };
    }
    if (process.env.KNOWME_ANDROID_SELF_HOST_ONLY === 'true') {
      return { release: null };
    }
    const configured = readAndroidReleaseNotice(process.env);

    // Fail closed for incomplete manual configuration; do not substitute an
    // unverified source when an operator tried to pin a release.
    const manuallyConfigured = Boolean(
      process.env.KNOWME_ANDROID_UPDATE_URL ||
      process.env.KNOWME_ANDROID_UPDATE_SHA256 ||
      process.env.KNOWME_ANDROID_UPDATE_VERSION_CODE
    );
    if (manuallyConfigured && !configured) return { release: null };
    if (process.env.KNOWME_ANDROID_AUTO_DISCOVER_GITHUB === 'false') {
      return { release: configured };
    }
    // Production-signed releases always remain pinned to their own channel.
    if (configured &&
      !/\/releases\/download\/v\d+\.\d+\.\d+-preview\//.test(configured.url)) {
      return { release: configured };
    }
    const publishedPreview = await discoverPublishedAndroidRelease();
    return { release: chooseAndroidRelease(configured, publishedPreview) };
  }
}

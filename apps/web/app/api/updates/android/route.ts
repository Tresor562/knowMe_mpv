import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// One-time bridge for KnowMe 1.1.6 and older APKs. These APKs expect
// GitHub-style preview URLs and cannot be reprogrammed retroactively.
// The new APK from 1.1.7 onward reads only the KnowMe-owned VPS API.
// This compatibility endpoint never authorizes installation by itself.
const TAG = 'v1.1.7-preview';
const VERSION = '1.1.7';
const CODE = 9;
const REPO = 'Tresor562/knowMe_mpv';
const PREFIX = 'https://github.com/' + REPO + '/releases/download/' + TAG + '/';
const APK = 'KnowMe-' + VERSION + '-preview.apk';
const RELEASE_API = 'https://api.github.com/repos/' + REPO + '/releases/tags/' + TAG;
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'KnowMe-1.1.6-Bridge' };

type Asset = { name?: string; browser_download_url?: string; size?: number };
type GitHubRelease = { prerelease?: boolean; draft?: boolean; tag_name?: string; assets?: Asset[] };

async function oneTimeBridge() {
  const response = await fetch(RELEASE_API, {
    headers, cache: 'no-store', signal: AbortSignal.timeout(6500)
  });
  if (!response.ok) return null;
  const release = await response.json() as GitHubRelease;
  if (release.draft || release.prerelease !== true || release.tag_name !== TAG) return null;
  const apk = release.assets?.find(asset =>
    asset.name === APK && asset.browser_download_url === PREFIX + APK &&
    typeof asset.size === 'number' && asset.size >= 10_000_000);
  const digest = release.assets?.find(asset =>
    asset.name === APK + '.sha256' &&
    asset.browser_download_url === PREFIX + APK + '.sha256');
  const manifest = release.assets?.find(asset =>
    asset.name === 'knowme-update.json' &&
    asset.browser_download_url === PREFIX + 'knowme-update.json');
  if (!apk || !digest || !manifest) return null;
  const manifestResult = await fetch(PREFIX + 'knowme-update.json', {
    cache: 'no-store', signal: AbortSignal.timeout(6500)
  });
  if (!manifestResult.ok) return null;
  const text = await manifestResult.text();
  if (text.length > 4096) return null;
  const data = JSON.parse(text) as Record<string, unknown>;
  if (data.version !== VERSION || data.versionCode !== CODE ||
      data.url !== PREFIX + APK || typeof data.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/i.test(data.sha256)) return null;
  return {
    version: VERSION,
    versionCode: CODE,
    url: PREFIX + APK,
    sha256: data.sha256.toLowerCase(),
    notes: 'Mise à jour de transition vers les notifications gérées par KnowMe.',
    required: false
  };
}

export async function GET() {
  try {
    return NextResponse.json({ release: await oneTimeBridge() },
      { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return NextResponse.json({ release: null },
      { headers: { 'Cache-Control': 'no-store' } });
  }
}

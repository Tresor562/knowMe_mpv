import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// One-time bridge for KnowMe 1.1.6 and older APKs. These APKs expect
// GitHub-style preview URLs and cannot be reprogrammed retroactively.
// The new APK from 1.1.7 onward reads only the KnowMe-owned VPS API.
// This compatibility endpoint never authorizes installation by itself.
// Temporary transition for older installs; new APKs use only the VPS.
// Choose the newest immutable and published compatible preview.
const PREVIEW_BRIDGE = [
  { version: '1.1.7', code: 9 },
  { version: '1.1.6', code: 8 }
] as const;
const REPO = 'Tresor562/knowMe_mpv';
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'KnowMe-1.1.6-Bridge' };

type Asset = { name?: string; browser_download_url?: string; size?: number };
type GitHubRelease = { prerelease?: boolean; draft?: boolean; tag_name?: string; assets?: Asset[] };

async function oneTimeBridgeVersion(version: string, code: number) {
  const tag = 'v' + version + '-preview';
  const prefix = 'https://github.com/' + REPO + '/releases/download/' + tag + '/';
  const apkName = 'KnowMe-' + version + '-preview.apk';
  const releaseApi = 'https://api.github.com/repos/' + REPO + '/releases/tags/' + tag;
  const response = await fetch(releaseApi, {
    headers, cache: 'no-store', signal: AbortSignal.timeout(6500)
  });
  if (!response.ok) return null;
  const release = await response.json() as GitHubRelease;
  if (release.draft || release.prerelease !== true || release.tag_name !== tag) return null;
  const apk = release.assets?.find(asset =>
    asset.name === apkName && asset.browser_download_url === prefix + apkName &&
    typeof asset.size === 'number' && asset.size >= 10_000_000);
  const digest = release.assets?.find(asset =>
    asset.name === apkName + '.sha256' &&
    asset.browser_download_url === prefix + apkName + '.sha256');
  const manifest = release.assets?.find(asset =>
    asset.name === 'knowme-update.json' &&
    asset.browser_download_url === prefix + 'knowme-update.json');
  if (!apk || !digest || !manifest) return null;
  const manifestResult = await fetch(prefix + 'knowme-update.json', {
    cache: 'no-store', signal: AbortSignal.timeout(6500)
  });
  if (!manifestResult.ok) return null;
  const text = await manifestResult.text();
  if (text.length > 4096) return null;
  const data = JSON.parse(text) as Record<string, unknown>;
  if (data.version !== version || data.versionCode !== code ||
      data.url !== prefix + apkName || typeof data.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/i.test(data.sha256)) return null;
  return {
    version,
    versionCode: code,
    url: prefix + apkName,
    sha256: data.sha256.toLowerCase(),
    notes: 'Mise à jour de transition vers les notifications gérées par KnowMe.',
    required: false
  };
}

async function oneTimeBridge() {
  for (const { version, code } of PREVIEW_BRIDGE) {
    try {
      const release = await oneTimeBridgeVersion(version, code);
      if (release) return release;
    } catch {
      // A missing future release must not hide the verified fallback.
    }
  }
  return null;
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

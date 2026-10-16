import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Notice = {
  versionCode: number; version: string; url: string;
  sha256: string; notes: string; required: boolean;
};
type Release = {
  draft?: boolean; prerelease?: boolean; tag_name?: string;
  assets?: Array<{ name?: string; browser_download_url?: string; size?: number }>;
};

const REPO = 'https://github.com/Tresor562/knowMe_mpv/releases/download/';
const RELEASES = 'https://api.github.com/repos/Tresor562/knowMe_mpv/releases?per_page=10';
const CACHE_MS = 5 * 60 * 1000;
let cached: Notice | null = null;
let cacheUntil = 0;
let pending: Promise<Notice | null> | null = null;

function trustedNotice(raw: unknown, release: Release): Notice | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(data.version)) return null;
  if (!Number.isSafeInteger(data.versionCode) || Number(data.versionCode) < 1) return null;
  if (typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(data.sha256)) return null;
  if (typeof data.url !== 'string') return null;
  if (release.tag_name !== `v${data.version}-preview`) return null;
  const apkName = `KnowMe-${data.version}-preview.apk`;
  const expected = `${REPO}${release.tag_name}/${apkName}`;
  if (data.url !== expected) return null;
  const apk = release.assets?.find(asset =>
    asset.name === apkName && asset.browser_download_url === expected &&
    typeof asset.size === 'number' && asset.size > 10_000_000
  );
  const checksum = release.assets?.find(asset =>
    asset.name === `${apkName}.sha256` &&
    asset.browser_download_url === `${expected}.sha256`
  );
  if (!apk || !checksum) return null;
  return {
    versionCode: Number(data.versionCode),
    version: data.version,
    sha256: data.sha256.toLowerCase(),
    url: expected,
    notes: typeof data.notes === 'string' ? data.notes.slice(0, 500) : 'Une mise à jour KnowMe est disponible.',
    required: data.required === true
  };
}

async function latestPublishedPreview(): Promise<Notice | null> {
  if (Date.now() < cacheUntil) return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch(RELEASES, {
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'KnowMe-Android-Update' },
        signal: AbortSignal.timeout(6500),
        cache: 'no-store'
      });
      if (!response.ok) return cached;
      const releases = await response.json() as Release[];
      if (!Array.isArray(releases)) return cached;
      let best: Notice | null = null;
      for (const release of releases) {
        if (release.draft || release.prerelease !== true ||
            !/^v\d+\.\d+\.\d+-preview$/.test(release.tag_name ?? '')) continue;
        const asset = release.assets?.find(asset =>
          asset.name === 'knowme-update.json' &&
          asset.browser_download_url === `${REPO}${release.tag_name}/knowme-update.json`
        );
        if (!asset?.browser_download_url) continue;
        try {
          const result = await fetch(asset.browser_download_url, {
            signal: AbortSignal.timeout(6500),
            cache: 'no-store'
          });
          if (!result.ok) continue;
          const raw = await result.text();
          if (raw.length > 4096) continue;
          const notice = trustedNotice(JSON.parse(raw), release);
          if (notice && (!best || notice.versionCode > best.versionCode)) best = notice;
        } catch {
          // An invalid individual release does not invalidate other releases.
        }
      }
      if (best) cached = best;
      return cached;
    } catch {
      return cached;
    } finally {
      cacheUntil = Date.now() + CACHE_MS;
    }
  })().finally(() => { pending = null; });
  return pending;
}

export async function GET() {
  const release = await latestPublishedPreview();
  return NextResponse.json({ release }, {
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

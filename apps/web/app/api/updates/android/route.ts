import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// The Web update screen is a convenience proxy. The VPS remains the single
// authority for versions and hosts the APKs. GitHub/Vercel do not store APKs.
const KNOWME_VPS_FEED =
  'https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android';

type Release = {
  versionCode: number; version: string; url: string;
  sha256: string; notes: string; required: boolean;
};

function verifiedVpsRelease(raw: unknown): Release | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Number.isSafeInteger(r.versionCode) || Number(r.versionCode) < 1 ||
      typeof r.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(r.version) ||
      typeof r.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(r.sha256)) return null;
  const expected = 'https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android/apk/KnowMe-' +
    r.version + '-preview.apk';
  if (r.url !== expected) return null;
  return {
    versionCode: Number(r.versionCode),
    version: r.version,
    url: expected,
    sha256: r.sha256,
    notes: typeof r.notes === 'string' ? r.notes.slice(0, 500) : '',
    required: r.required === true
  };
}

export async function GET() {
  try {
    const response = await fetch(KNOWME_VPS_FEED, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) throw new Error('VPS_FEED_UNAVAILABLE');
    const data = await response.json() as { release?: unknown };
    return NextResponse.json({
      release: verifiedVpsRelease(data.release)
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ release: null }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}

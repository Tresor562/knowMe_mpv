/**
 * Read-only projection of a server-authorized APK update notice.
 * The UI never trusts an arbitrary URL, synthetic availability or user-supplied
 * price. App catalog publishing requires a separate moderated API.
 */
export type OfficialApkRelease = {
  version: string;
  versionCode: number;
  url: string;
  sha256: string;
  notes: string;
  required: boolean;
};

export function parseOfficialApkRelease(raw: unknown): OfficialApkRelease | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const version = value.version;
  const versionCode = value.versionCode;
  const url = value.url;
  const sha256 = value.sha256;
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
    !Number.isSafeInteger(versionCode) || Number(versionCode) < 1 ||
    typeof url !== 'string' || typeof sha256 !== 'string' ||
    !/^[a-f\d]{64}$/i.test(sha256)) return null;

  let parsedUrl: URL;
  try { parsedUrl = new URL(url); } catch { return null; }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password ||
    parsedUrl.hash || parsedUrl.search) return null;

  const apkName = 'KnowMe-' + version + '-preview.apk';
  const githubPath = '/Tresor562/knowMe_mpv/releases/download/v' +
    version + '-preview/' + apkName;
  const officialGithub = parsedUrl.hostname === 'github.com' &&
    parsedUrl.pathname === githubPath;
  // A matching filename on a third-party host does not make an APK official.
  // This must match the origin configured by KnowMe's VPS update publisher.
  const officialVps = parsedUrl.hostname === '31-56-85-53.sslip.io' &&
    parsedUrl.port === '' &&
    parsedUrl.pathname === '/knowme-api/mobile-updates/android/apk/' + apkName;

  if (!officialGithub && !officialVps) return null;

  return {
    version,
    versionCode: Number(versionCode),
    url: parsedUrl.toString(),
    sha256: sha256.toLowerCase(),
    notes: typeof value.notes === 'string' ? value.notes.slice(0, 500) : '',
    required: value.required === true
  };
}

export function officialApkFromUpdateResponse(response: unknown): OfficialApkRelease | null {
  if (!response || typeof response !== 'object') return null;
  return parseOfficialApkRelease((response as { release?: unknown }).release);
}

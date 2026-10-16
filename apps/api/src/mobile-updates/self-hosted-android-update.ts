import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

export type HostedAndroidRelease = {
  versionCode: number;
  version: string;
  url: string;
  sha256: string;
  notes: string;
  required: boolean;
};

const PREVIEW_CERT = 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c';
const MANIFEST = 'android-preview.json';
const DEFAULT_BASE = 'https://31-56-85-53.sslip.io/knowme-api';

function releaseDirectory() {
  return process.env.KNOWME_ANDROID_UPDATES_DIR?.trim() || '/srv/knowme-updates';
}

function publicBase() {
  const raw = process.env.KNOWME_ANDROID_UPDATE_BASE_URL?.trim() || DEFAULT_BASE;
  try {
    const value = new URL(raw);
    if (value.protocol !== 'https:' || value.username || value.password ||
        value.search || value.hash || value.pathname.includes('..')) return null;
    return value.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function validateHostedManifest(raw: unknown): (HostedAndroidRelease & {
  filename: string;
  size: number;
}) | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;
  if (!Number.isSafeInteger(entry.versionCode) || Number(entry.versionCode) < 1 ||
      typeof entry.version !== 'string' ||
      !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(entry.version) ||
      typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      entry.signingCertSha256 !== PREVIEW_CERT ||
      entry.filename !== 'KnowMe-' + entry.version + '-preview.apk' ||
      !Number.isSafeInteger(entry.size) ||
      Number(entry.size) < 10_000_000 || Number(entry.size) > 250_000_000) return null;
  const base = publicBase();
  if (!base) return null;
  return {
    filename: String(entry.filename),
    size: Number(entry.size),
    versionCode: Number(entry.versionCode),
    version: entry.version,
    sha256: entry.sha256,
    notes: typeof entry.notes === 'string'
      ? entry.notes.slice(0, 500)
      : 'Une nouvelle version KnowMe est disponible.',
    required: entry.required === true,
    url: base + '/mobile-updates/android/apk/' + entry.filename
  };
}

function validBinary(filename: string, expectedSize: number): string | null {
  const root = releaseDirectory();
  try {
    const actualRoot = realpathSync(root);
    const binary = realpathSync(join(root, filename));
    if (!binary.startsWith(actualRoot + sep)) return null;
    const stat = statSync(binary);
    if (!stat.isFile() || stat.size !== expectedSize) return null;
    return binary;
  } catch {
    return null;
  }
}

/** Manifest is atomically published after apksigner and SHA-256 checks.
 * A missing/malformed manifest never advertises an unverified APK. */
export function readHostedAndroidRelease() {
  const directory = releaseDirectory();
  const manifestPath = join(directory, MANIFEST);
  if (!existsSync(manifestPath)) return null;
  try {
    const raw = readFileSync(manifestPath, 'utf8');
    if (raw.length > 4096) return null;
    const release = validateHostedManifest(JSON.parse(raw));
    if (!release || !validBinary(release.filename, release.size)) return null;
    return release;
  } catch {
    return null;
  }
}

export function openHostedAndroidApk(filename: string) {
  const release = readHostedAndroidRelease();
  if (!release || filename !== release.filename) return null;
  const path = validBinary(filename, release.size);
  if (!path) return null;
  return {
    size: release.size,
    filename: release.filename,
    stream: createReadStream(path)
  };
}

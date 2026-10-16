#!/usr/bin/env node
/**
 * Pull-only release mirroring. GitHub never connects to the VPS and no
 * repository SSH secret is needed. End-user APKs are hosted by KnowMe.
 *
 * Requires Node.js 22, curl-free HTTPS, and local aapt/apksigner build tools.
 * The publisher verifies APK package, version, and Android signing certificate.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const REPO = 'Tresor562/knowMe_mpv';
const API = 'https://api.github.com/repos/' + REPO + '/releases?per_page=12';
const ASSETS = 'https://github.com/' + REPO + '/releases/download/';
const ROOT = process.env.KNOWME_ANDROID_UPDATES_HOST_DIR || '/var/lib/knowme-android-updates';
const MAX_APK_SIZE = 250_000_000;
const TIMEOUT_MS = 180_000;

async function fetchText(url, maxBytes = 24_000) {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'KnowMe-VPS-Release-Mirror' },
    signal: AbortSignal.timeout(10_000),
    redirect: 'follow',
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Release feed unavailable: HTTP ' + response.status);
  const body = await response.text();
  if (Buffer.byteLength(body) > maxBytes) throw new Error('Oversized release manifest');
  return body;
}
function matchRelease(data, tag) {
  if (!data || typeof data !== 'object') return null;
  const version = String(data.version || '');
  const code = Number(data.versionCode);
  const filename = 'KnowMe-' + version + '-preview.apk';
  if (!/^\d+\.\d+\.\d+$/.test(version) || !Number.isSafeInteger(code) || code < 1 ||
    typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(data.sha256) ||
    tag !== 'v' + version + '-preview' ||
    data.url !== ASSETS + tag + '/' + filename) return null;
  return { version, code, filename, sha256: data.sha256.toLowerCase() };
}
function currentVersionCode() {
  try {
    const data = JSON.parse(readFileSync(join(ROOT, 'android-preview.json'), 'utf8'));
    return Number.isSafeInteger(data.versionCode) ? data.versionCode : 0;
  } catch { return 0; }
}
async function findNewestRelease() {
  const releases = JSON.parse(await fetchText(API, 500_000));
  if (!Array.isArray(releases)) throw new Error('Invalid release index');
  let best = null;
  for (const release of releases) {
    if (release.draft || release.prerelease !== true ||
      !/^v\d+\.\d+\.\d+-preview$/.test(release.tag_name || '')) continue;
    const base = ASSETS + release.tag_name + '/';
    const manifest = release.assets?.find(a => a.name === 'knowme-update.json'
      && a.browser_download_url === base + 'knowme-update.json');
    if (!manifest) continue;
    const candidate = matchRelease(JSON.parse(await fetchText(manifest.browser_download_url)), release.tag_name);
    if (!candidate) continue;
    const apk = release.assets?.find(a => a.name === candidate.filename &&
      a.browser_download_url === base + candidate.filename &&
      a.size >= 10_000_000 && a.size <= MAX_APK_SIZE);
    const digest = release.assets?.find(a => a.name === candidate.filename + '.sha256' &&
      a.browser_download_url === base + candidate.filename + '.sha256');
    if (!apk || !digest) continue;
    // Manifest digest and independently published .sha256 asset must agree.
    const checksum = await fetchText(digest.browser_download_url);
    if (!checksum.toLowerCase().startsWith(candidate.sha256 + ' ')) continue;
    if (!best || candidate.code > best.code) best = { ...candidate, url: apk.browser_download_url, size: apk.size };
  }
  return best;
}
async function downloadApk(release, filename) {
  const request = await fetch(release.url, {
    headers: { 'User-Agent': 'KnowMe-VPS-Release-Mirror' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow'
  });
  if (!request.ok || !request.body) throw new Error('APK download failed: HTTP ' + request.status);
  // A canonical GitHub Releases URL redirects to GitHub's release-assets CDN.
  const destination = new URL(request.url);
  if (destination.protocol !== 'https:' ||
    !['github.com', 'release-assets.githubusercontent.com'].includes(destination.hostname)) {
    throw new Error('APK download redirected to an unapproved host');
  }
  let written = 0;
  const hash = createHash('sha256');
  const verifier = new Transform({
    transform(chunk, encoding, callback) {
      written += chunk.length;
      if (written > MAX_APK_SIZE) return callback(new Error('APK exceeds size limit'));
      hash.update(chunk);
      callback(null, chunk);
    }
  });
  await pipeline(Readable.fromWeb(request.body), verifier, createWriteStream(filename, { flags: 'wx', mode: 0o600 }));
  if (written !== release.size || hash.digest('hex') !== release.sha256) {
    throw new Error('APK checksum or size does not match the published manifest');
  }
}

async function main() {
  const current = currentVersionCode();
  const next = await findNewestRelease();
  if (!next || next.code <= current) {
    console.log(JSON.stringify({ ok: true, updated: false, current }));
    return;
  }
  const directory = mkdtempSync(join(tmpdir(), 'knowme-verified-apk-'));
  try {
    const apk = join(directory, next.filename);
    await downloadApk(next, apk);
    execFileSync(process.execPath, [
      new URL('./publish-knowme-android-vps.mjs', import.meta.url).pathname,
      apk, next.version, String(next.code)
    ], { timeout: 180_000, stdio: 'inherit', env: process.env });
    console.log(JSON.stringify({ ok: true, updated: true, version: next.version, versionCode: next.code }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(e => {
  console.error('KnowMe VPS update mirror failed:', e instanceof Error ? e.message : 'unknown error');
  process.exitCode = 1;
});

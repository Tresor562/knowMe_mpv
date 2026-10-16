#!/usr/bin/env node
/**
 * One-time APK promotion on the KnowMe VPS.
 * Example:
 * KNOWME_APKSIGNER_PATH=/opt/android-sdk/build-tools/35.0.0/apksigner \
 * KNOWME_AAPT_PATH=/opt/android-sdk/build-tools/35.0.0/aapt \
 * node ops/publish-knowme-android-vps.mjs /tmp/KnowMe-1.1.8-preview.apk 1.1.8 10
 *
 * The APK must be copied to the VPS first (CI can use SFTP/SSH).
 * A manifest is atomically switched only after signature, package,
 * versionCode, size and hash are independently validated on that VPS.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, openSync, readFileSync,
  renameSync, statSync, unlinkSync, writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';

const EXPECTED_CERT = 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c';
const root = resolve(process.env.KNOWME_ANDROID_UPDATES_HOST_DIR || '/var/lib/nex/runtime/knowme/updates');
const [source, version, codeRaw] = process.argv.slice(2);
if (!source || !version || !codeRaw) {
  throw new Error('Usage: node ops/publish-knowme-android-vps.mjs <apk-path> <version> <versionCode>');
}
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
  throw new Error('Invalid KnowMe version');
}
const code = Number(codeRaw);
if (!Number.isSafeInteger(code) || code < 2) throw new Error('Invalid Android versionCode');
const sourceStat = statSync(source);
if (!sourceStat.isFile() || sourceStat.size < 10_000_000 || sourceStat.size > 250_000_000) {
  throw new Error('APK size is invalid');
}

const signer = process.env.KNOWME_APKSIGNER_PATH || 'apksigner';
const aapt = process.env.KNOWME_AAPT_PATH || 'aapt';
function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', timeout: 120_000, maxBuffer: 1024 * 1024 });
}
const certificate = run(signer, ['verify', '--print-certs', source])
  .match(/Signer #1 certificate SHA-256 digest:\s*([a-f0-9]{64})/i)?.[1]?.toLowerCase();
if (certificate !== EXPECTED_CERT) {
  throw new Error('Signature incompatible with existing KnowMe Android preview installs');
}
const badge = run(aapt, ['dump', 'badging', source]);
const identity = badge.match(/^package:\s+name='([^']+)'\s+versionCode='([^']+)'\s+versionName='([^']+)'/m);
if (!identity || identity[1] !== 'com.knowme.app' ||
    identity[2] !== String(code) || identity[3] !== version) {
  throw new Error('APK identity or version mismatch');
}
const hash = createHash('sha256');
const bytes = readFileSync(source);
hash.update(bytes);
const sha256 = hash.digest('hex');
const filename = 'KnowMe-' + version + '-preview.apk';
const manifest = join(root, 'android-preview.json');
mkdirSync(root, { recursive: true, mode: 0o755 });

if (existsSync(manifest)) {
  const current = JSON.parse(readFileSync(manifest, 'utf8'));
  const previous = Number(current.versionCode);
  if (Number.isSafeInteger(previous) && code < previous) {
    throw new Error('Rollback refused: versionCode must not decrease');
  }
  if (code === previous && (current.sha256 !== sha256 || current.version !== version)) {
    throw new Error('Existing versionCode cannot be replaced with different APK');
  }
}
const target = join(root, filename);
if (existsSync(target)) {
  const previousHash = createHash('sha256').update(readFileSync(target)).digest('hex');
  if (previousHash !== sha256) throw new Error('Immutable APK path collision');
} else {
  const tmp = target + '.tmp-' + process.pid;
  try {
    copyFileSync(source, tmp);
    if (createHash('sha256').update(readFileSync(tmp)).digest('hex') !== sha256) {
      throw new Error('Copy checksum mismatch');
    }
    renameSync(tmp, target);
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}
const notice = {
  versionCode: code,
  version,
  filename,
  size: sourceStat.size,
  sha256,
  signingCertSha256: EXPECTED_CERT,
  notes: 'Une nouvelle version KnowMe est disponible. Installation depuis KnowMe.',
  required: false
};
const tempManifest = manifest + '.tmp-' + process.pid;
try {
  const body = JSON.stringify(notice, null, 2) + '\n';
  const fd = openSync(tempManifest, 'wx', 0o644);
  try {
    writeFileSync(fd, body);
  } finally {
    const { closeSync } = await import('node:fs');
    closeSync(fd);
  }
  renameSync(tempManifest, manifest);
} finally {
  if (existsSync(tempManifest)) unlinkSync(tempManifest);
}
console.log(JSON.stringify({ ok: true, version, versionCode: code, sha256, filename, hostRoot: root }));

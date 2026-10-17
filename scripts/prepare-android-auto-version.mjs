#!/usr/bin/env node
/**
 * Assign a monotonic Android update version to a disposable CI checkout.
 * The product's committed version remains the source of truth for the Web;
 * every APK build receives a unique forward-only versionCode and filename.
 * This script NEVER pushes changes back to GitHub.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FILES = [
  'packages/link-contract/src/platform-sync.json',
  'apps/web/package.json',
  'apps/api/package.json',
  'apps/mobile/app.json'
];
export function computeAndroidAutoVersion(sequence, productVersion, currentCode) {
  const n = Number(sequence);
  if (!Number.isSafeInteger(n) || n < 1 || n > 1_000_000) {
    throw new Error('GitHub Actions run_number must be an integer from 1 to 1000000');
  }
  if (!/^\d+\.\d+\.\d+$/.test(productVersion)) {
    throw new Error('Invalid product version');
  }
  const versionCode = 10000 + n;
  if (versionCode <= currentCode) {
    throw new Error('Automatic APK versionCode must exceed the committed Android versionCode');
  }
  const [major, minor] = productVersion.split('.');
  return { version: `${major}.${minor}.${versionCode}`, versionCode };
}

export function stampAndroidAutoVersion(root, sequence, sourceSha) {
  if (!/^[a-f0-9]{40}$/i.test(sourceSha)) {
    throw new Error('Expected an exact Git commit SHA');
  }
  const records = FILES.map(name => {
    const file = join(root, name);
    return { file, name, data: JSON.parse(readFileSync(file, 'utf8')) };
  });
  const product = records[0].data;
  const mobile = records[3].data;
  const original = product.productVersion;
  if (records[1].data.version !== original ||
      records[2].data.version !== original ||
      mobile.expo?.version !== original) {
    throw new Error('Web/API/Android source versions must agree before APK stamping');
  }
  const { version, versionCode } = computeAndroidAutoVersion(
    sequence, original, mobile.expo.android.versionCode
  );
  product.productVersion = version;
  records[1].data.version = version;
  records[2].data.version = version;
  mobile.expo.version = version;
  mobile.expo.android.versionCode = versionCode;
  for (const record of records) {
    writeFileSync(record.file, JSON.stringify(record.data, null, 2) + '\n');
  }
  const metadata = {
    sourceSha: sourceSha.toLowerCase(),
    productVersion: original,
    version,
    versionCode,
    channel: 'preview'
  };
  writeFileSync(join(root, '.knowme-android-release.json'), JSON.stringify(metadata, null, 2) + '\n');
  return metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const metadata = stampAndroidAutoVersion(
    ROOT, process.argv[2], process.env.GITHUB_SHA || ''
  );
  console.log(JSON.stringify(metadata));
}

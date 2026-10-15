#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const requiredSecrets = [
  'KNOWME_ANDROID_KEYSTORE_PATH',
  'KNOWME_ANDROID_KEYSTORE_PASSWORD',
  'KNOWME_ANDROID_KEY_ALIAS',
  'KNOWME_ANDROID_KEY_PASSWORD'
];

export function configureReleaseSigning(source) {
  if (!source.includes('signingConfigs {') ||
      !source.includes('buildTypes {') ||
      !source.includes('release {')) {
    throw new Error('Unknown Gradle structure; refusing to patch signing.');
  }
  if (source.includes('knowmeRelease {')) return source;
  const signer = `signingConfigs {
        knowmeRelease {
            storeFile file(System.getenv("KNOWME_ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("KNOWME_ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("KNOWME_ANDROID_KEY_ALIAS")
            keyPassword System.getenv("KNOWME_ANDROID_KEY_PASSWORD")
        }`;
  let modified = source.replace('signingConfigs {', signer);
  const buildTypes = modified.indexOf('buildTypes {');
  const release = modified.indexOf('release {', buildTypes);
  const debugSigning = modified.indexOf('signingConfig signingConfigs.debug', release);
  if (debugSigning === -1) {
    throw new Error('Release signing anchor not found. Refusing unsigned APK.');
  }
  modified = modified.slice(0, debugSigning) +
    'signingConfig signingConfigs.knowmeRelease' +
    modified.slice(debugSigning + 'signingConfig signingConfigs.debug'.length);
  return modified;
}

async function main() {
  const missing = requiredSecrets.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error('Stable Android release signing not configured (' +
      missing.join(', ') + '). No APK is published.');
  }
  const file = fileURLToPath(
    new URL('../apps/mobile/android/app/build.gradle', import.meta.url)
  );
  const original = await readFile(file, 'utf8');
  const modified = configureReleaseSigning(original);
  await writeFile(file, modified, 'utf8');
  console.log('Android release configured to use stable private signing key.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((cause) => {
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  });
}

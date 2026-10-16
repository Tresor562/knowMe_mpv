#!/usr/bin/env node
// Converts an Expo SDK 53 Android export into an immutable Expo Updates v1
// manifest and release assets. This script NEVER publishes to production.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, copyFile, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'apps/mobile/dist');
const STAGE = join(ROOT, 'artifacts/knowme-ota');
const runtime = 'knowme-android-sdk53-native7';
const sourceSha = process.env.GITHUB_SHA;
if (!sourceSha || !/^[a-f0-9]{40}$/.test(sourceSha)) {
  throw new Error('A verified GitHub commit SHA is required.');
}
if (process.env.GITHUB_REPOSITORY !== 'Tresor562/knowMe_mpv') {
  throw new Error('Unexpected release repository');
}
const tag = `knowme-ota-preview-native7-${sourceSha}`;
const origin = `https://github.com/Tresor562/knowMe_mpv/releases/download/${tag}/`;
const metadata = JSON.parse(await readFile(join(DIST, 'metadata.json'), 'utf8'));
const expoClient = JSON.parse(await readFile(join(DIST, 'expo-config.json'), 'utf8'));
const config = JSON.parse(await readFile(join(ROOT, 'apps/mobile/app.json'), 'utf8')).expo;
if (config.runtimeVersion !== runtime || config.android.versionCode !== 7 ||
    config.updates?.requestHeaders?.['expo-channel-name'] !== 'preview') {
  throw new Error('Native runtime/channel changed: build a new Android binary first.');
}
const platform = metadata.fileMetadata?.android;
if (typeof platform?.bundle !== 'string' || !Array.isArray(platform.assets)) {
  throw new Error('Invalid Expo Android export metadata');
}
if (!platform.assets.every(item => typeof item === 'string')) {
  throw new Error('Invalid asset paths');
}

await mkdir(STAGE, { recursive: true });
const stage = new Map();
async function pack(file) {
  if (file.startsWith('/') || file.includes('\\') || file.split('/').includes('..')) {
    throw new Error('Export contains an unsafe asset path: ' + file);
  }
  const absolute = resolve(DIST, file);
  if (!absolute.startsWith(DIST + sep)) throw new Error('Outside the export directory');
  const info = await stat(absolute);
  if (!info.isFile() || info.size < 1 || info.size > 100_000_000) {
    throw new Error('Invalid update asset: ' + file);
  }
  const bytes = await readFile(absolute);
  const sha = createHash('sha256').update(bytes).digest('base64url');
  const md5 = createHash('md5').update(bytes).digest('hex');
  const extension = extname(file).toLowerCase();
  const accepted = new Set(['.js','.hbc','.png','.jpg','.jpeg','.webp','.ttf','.otf','.gif','.mp3','.mp4','.wav','.json']);
  if (!accepted.has(extension)) throw new Error('Unsupported asset extension: ' + extension);
  const fileName = sha.replaceAll(/[^a-zA-Z0-9_-]/g, '') + extension;
  if (!stage.has(fileName)) {
    await copyFile(absolute, join(STAGE, fileName));
    stage.set(fileName, true);
  }
  const mime = ({
    '.js':'application/javascript', '.hbc':'application/javascript',
    '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
    '.webp':'image/webp', '.ttf':'font/ttf', '.otf':'font/otf',
    '.gif':'image/gif', '.mp3':'audio/mpeg', '.mp4':'video/mp4',
    '.wav':'audio/wav', '.json':'application/json'
  })[extension];
  return {
    key: md5,
    hash: sha,
    contentType: mime,
    fileExtension: extension.slice(1),
    url: origin + fileName
  };
}
const launchAsset = await pack(platform.bundle);
const assets = [];
for (const name of new Set(platform.assets)) assets.push(await pack(name));
const manifest = {
  id: randomUUID(),
  createdAt: new Date().toISOString(),
  runtimeVersion: runtime,
  launchAsset,
  assets,
  metadata: { platform: 'android', channel: 'preview', commit: sourceSha },
  extra: { expoClient }
};
await writeFile(join(STAGE, 'expo-ota-manifest.json'), JSON.stringify(manifest,null,2) + '\n');
console.log(JSON.stringify({ tag, runtimeVersion: runtime, releaseAssets: stage.size + 1, bundle: platform.bundle },null,2));

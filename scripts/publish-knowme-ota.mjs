#!/usr/bin/env node
// Offline publisher for assets produced by `expo export --platform android`.
// The only mutable pointer is active/<channel>/<runtime>.json. Release
// promotion requires --publish and a VPS local filesystem, never an API token.
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  renameSync, rmSync, statSync, writeFileSync
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, join, resolve, sep } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).filter(s=>s.startsWith('--')).map(s=>{
  const idx=s.indexOf('=');
  return idx<0?[s.slice(2),'true']:[s.slice(2,idx),s.slice(idx+1)];
}));
const VALID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const channels = new Set(['preview','production']);
const runtime=args.runtime;
const channel=args.channel;
const root=args.root||'/var/lib/knowme-expo-updates';
const dist=resolve(args.dist||'apps/mobile/dist');
const base=args.url||process.env.KNOWME_OTA_PUBLIC_URL||'';
if (!VALID.test(runtime||'') || runtime.includes('..') || !channels.has(channel) ||
  !base.startsWith('https://') || !base.endsWith('/mobile-updates/ota')) {
  throw new Error('Expected --runtime=<native runtime> --channel=preview|production --url=https://.../mobile-updates/ota');
}
function parse(file) {
  return JSON.parse(readFileSync(join(dist,file),'utf8'));
}
function withinDist(file) {
  if (!/^[a-zA-Z0-9_.\/-]{1,256}$/.test(file) ||
    file.includes('..') || file.startsWith('/') || file.startsWith('.')) {
    throw new Error('Unsafe Expo export path');
  }
  const full=resolve(dist,file);
  if (!full.startsWith(dist+sep)) throw new Error('Asset outside Expo export');
  if (!existsSync(full) || !statSync(full).isFile()) throw new Error('Missing Expo asset: '+file);
  if (statSync(full).size < 1 || statSync(full).size > 80*1024*1024) throw new Error('Asset size not allowed: '+file);
  return full;
}
const metadata=parse('metadata.json');
const expoClient=parse('expoConfig.json');
if (!metadata.fileMetadata?.android?.bundle ||
  !Array.isArray(metadata.fileMetadata.android.assets)) {
  throw new Error('Expected Expo SDK 53 android export metadata');
}
if (JSON.stringify(expoClient).length > 100000) throw new Error('Public Expo config too large');

function mime(ext) {
  const map={
    js:'application/javascript', hbc:'application/javascript', json:'application/json',
    png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp',
    svg:'image/svg+xml', gif:'image/gif', ttf:'font/ttf', otf:'font/otf',
    woff:'font/woff', woff2:'font/woff2', mp3:'audio/mpeg', mp4:'video/mp4',
    wav:'audio/wav', bin:'application/octet-stream', db:'application/octet-stream'
  };
  return map[ext]||'application/octet-stream';
}
const entries=[];
function asset(input,isLaunch=false) {
  if (!input || typeof input.path!=='string') throw new Error('Malformed metadata file path');
  const file=withinDist(input.path);
  const ext=(input.ext||basename(input.path).split('.').pop()||'bin').toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(ext)) throw new Error('Malformed extension');
  const data=readFileSync(file);
  const digest=createHash('sha256').update(data).digest('hex');
  const hash=createHash('sha256').update(data).digest('base64url');
  const key=createHash('md5').update(data).digest('hex');
  const contentType=mime(ext);
  entries.push({file,digest,contentType});
  return {key,hash,contentType,...(!isLaunch?{fileExtension:'.'+ext}:{}),
    url:base+'/assets/'+digest};
}
const launchAsset=asset({path:metadata.fileMetadata.android.bundle},true);
const assets=metadata.fileMetadata.android.assets.map(entry=>asset(entry));
const manifest={
  id:randomUUID(),createdAt:new Date().toISOString(),runtimeVersion:runtime,
  launchAsset,assets,metadata:{},extra:{expoClient}
};
const unique=new Map(entries.map(x=>[x.digest,x]));
// Validate export inputs before mutating active release or creating file paths.
if (args.publish!=='true') {
  process.stdout.write(JSON.stringify({dryRun:true,runtime,channel,assets:unique.size,updateId:manifest.id})+'\n');
  process.exit(0);
}
mkdirSync(join(root,'assets'),{recursive:true,mode:0o750});
mkdirSync(join(root,'active',channel),{recursive:true,mode:0o750});
for(const entry of unique.values()) {
  const dest=join(root,'assets',entry.digest);
  if (!existsSync(dest)) {
    const tmp=dest+'.tmp-'+randomUUID();
    copyFileSync(entry.file,tmp);
    const actual=createHash('sha256').update(readFileSync(tmp)).digest('hex');
    if(actual!==entry.digest) {rmSync(tmp,{force:true});throw new Error('Digest mismatch');}
    renameSync(tmp,dest);
  } else {
    const actual=createHash('sha256').update(readFileSync(dest)).digest('hex');
    if(actual!==entry.digest) throw new Error('Existing immutable asset has invalid hash');
  }
  const metadataFile=join(root,'assets',entry.digest+'.type');
  if(!existsSync(metadataFile)) writeFileSync(metadataFile,entry.contentType,{mode:0o640,flag:'wx'});
}
const active=join(root,'active',channel,runtime+'.json');
const tmp=active+'.tmp-'+randomUUID();
writeFileSync(tmp,JSON.stringify(manifest),{mode:0o640,flag:'wx'});
renameSync(tmp,active);
process.stdout.write(JSON.stringify({published:true,runtime,channel,assets:unique.size,updateId:manifest.id})+'\n');

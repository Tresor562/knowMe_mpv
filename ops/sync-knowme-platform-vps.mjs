#!/usr/bin/env node
/**
 * KnowMe VPS self-hosted release reconciler. It does NOT deploy a push or an
 * arbitrary main commit. It deploys only an immutable preview APK release
 * already mirrored and verified by the local Android publisher, whose exact
 * GitHub source commit has successful CI and APK checks. No GitHub SSH token
 * or vendor push service is needed on users' devices.
 */
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const repo = 'https://api.github.com/repos/Tresor562/knowMe_mpv';
const local = '/var/lib/knowme-android-updates/android-preview.json';
const runtime = '/var/lib/nex/runtime/knowme-platform';
const deployRoot = '/opt/nex/ops/knowme-platform/ops';
const apiOrigin = 'https://31-56-85-53.sslip.io/knowme-api';
const webOrigin = 'https://knowme.31-56-85-53.sslip.io';
mkdirSync(runtime, { recursive: true, mode: 0o700 });

async function json(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'KnowMe-Platform-VPS-Release' },
    signal: AbortSignal.timeout(12000), redirect: 'error', cache: 'no-store'
  });
  if (!response.ok) throw new Error('Metadata check failed HTTP ' + response.status);
  return response.json();
}
async function deployed(url) {
  try { return await json(url); } catch { return null; }
}
function start(name, sha) {
  const script = join(deployRoot, name);
  if (!existsSync(script)) throw new Error('Missing installed platform deploy script ' + name);
  execFileSync(process.execPath, [script], {
    encoding: 'utf8', timeout: 60 * 60000,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, KNOWME_DEPLOY_SHA: sha }
  });
}
async function verifyChecks(sha) {
  const checks = await json(repo + '/commits/' + sha + '/check-runs?per_page=100');
  const runs = checks?.check_runs || [];
  for (const name of ['quality', 'android-apk']) {
    if (!runs.some((run) => run.name === name && run.conclusion === 'success' &&
      run.head_sha?.toLowerCase() === sha)) {
      throw new Error('Cannot deploy ' + sha.slice(0, 12) + ': required ' + name + ' check is not green');
    }
  }
}
async function main() {
  if (!existsSync(local)) {
    console.log(JSON.stringify({ ok: true, deployed: false, reason: 'no locally verified APK release' }));
    return;
  }
  const notice = JSON.parse(readFileSync(local, 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(notice.version || '') ||
      !Number.isSafeInteger(notice.versionCode) || notice.versionCode < 1 ||
      !/^[a-f0-9]{64}$/i.test(notice.sha256 || '') ||
      !existsSync(join('/var/lib/knowme-android-updates', notice.filename || ''))) {
    throw new Error('Missing or invalid locally verified Android release');
  }
  const releases = await json(repo + '/releases?per_page=15');
  if (!Array.isArray(releases)) throw new Error('No verified release list');
  const tag = 'v' + notice.version + '-preview';
  const release = releases.find((r) => r.tag_name === tag && r.prerelease === true &&
    !r.draft && /^[a-f0-9]{40}$/i.test(r.target_commitish || '') &&
    r.assets?.some((asset) => asset.name === notice.filename && asset.size === notice.size) &&
    r.assets?.some((asset) => asset.name === 'knowme-update.json'));
  if (!release) throw new Error('Locally verified APK has no matching immutable GitHub release');
  const sha = release.target_commitish.toLowerCase();
  await verifyChecks(sha);
  const api = await deployed(apiOrigin + '/platform-sync/version');
  const web = await deployed(webOrigin + '/api/version');
  const apiCurrent = api?.commit === sha;
  const webCurrent = web?.commit === sha;
  if (apiCurrent && webCurrent && api.version === web.version) {
    console.log(JSON.stringify({ ok: true, deployed: false, sha, version: notice.version, reason: 'already synchronized' }));
    return;
  }
  // Do not replace an already newer published VPS release with an older APK.
  const currentFile = join(runtime, 'current-release.json');
  if (existsSync(currentFile)) {
    const previous = JSON.parse(readFileSync(currentFile, 'utf8'));
    if (Number.isSafeInteger(previous.versionCode) && previous.versionCode > notice.versionCode) {
      throw new Error('Refusing VPS release rollback');
    }
  }
  if (!apiCurrent) start('deploy-knowme-vps.mjs', sha);
  if (!webCurrent) start('deploy-knowme-web-vps.mjs', sha);
  const afterApi = await deployed(apiOrigin + '/platform-sync/version');
  const afterWeb = await deployed(webOrigin + '/api/version');
  if (afterApi?.commit !== sha || afterWeb?.commit !== sha ||
      afterApi.version !== afterWeb.version) {
    throw new Error('Post-deployment Web/API SHA or version mismatch');
  }
  const state = { sha, productVersion: afterApi.version, apkVersion: notice.version,
    versionCode: notice.versionCode, updatedAt: new Date().toISOString() };
  writeFileSync(currentFile + '.tmp', JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  renameSync(currentFile + '.tmp', currentFile);
  console.log(JSON.stringify({ ok: true, deployed: true, ...state }));
}
main().catch((error) => {
  console.error('KnowMe release reconciliation blocked:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

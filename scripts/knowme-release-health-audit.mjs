#!/usr/bin/env node
// Read-only release health probe. Not a deployment or device-install proof.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const ENDPOINTS = Object.freeze({
  api: 'https://31-56-85-53.sslip.io/knowme-api/platform-sync/version',
  ready: 'https://31-56-85-53.sslip.io/knowme-api/health/ready',
  web: 'https://knowme.31-56-85-53.sslip.io/api/version',
  android: 'https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android',
});
const SHA = /^[a-f0-9]{40}$/i;
const HEX = /^[a-f0-9]{64}$/i;
const VERSION = /^\d+\.\d+\.\d+$/;
const asObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Operator-configured GitHub policy; never proof of actual VPS runtime settings.
export function parseWebPolicy(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}


export function evaluateReleaseHealth(snapshot, { webEnabled = null } = {}) {
  const issues = [];
  const issue = (severity, code, detail) => issues.push({ severity, code, detail });
  const { api, ready, web, android } = snapshot;
  const validApi = asObject(api) && api.platform === 'api' && SHA.test(api.commit || '') &&
    VERSION.test(api.version || '');
  const validWeb = asObject(web) && web.platform === 'web' && SHA.test(web.commit || '') &&
    VERSION.test(web.version || '');
  if (webEnabled !== true && webEnabled !== false)
    issue('warning', 'web-policy-unknown', 'Web rollout policy unconfirmed; GitHub config is not VPS attestation');
  if (!validApi) issue('critical', 'api-identity', 'Invalid or unavailable API version metadata');
  if (!asObject(ready) || ready.status !== 'ready' || ready.checks?.database !== 'up')
    issue('critical', 'api-not-ready', 'API readiness or database is unhealthy');
  if (!validWeb) issue(webEnabled === true ? 'critical' : 'warning', 'web-identity',
    'Web identity endpoint is unavailable or invalid');
  if (validApi && validWeb && (api.commit.toLowerCase() !== web.commit.toLowerCase() ||
      api.version !== web.version || api.experienceRevision !== web.experienceRevision))
    issue(webEnabled === true ? 'critical' : 'warning',
      webEnabled === true ? 'web-api-drift' : webEnabled === false ? 'web-freeze' : 'web-policy-unknown-drift',
      webEnabled === true ? 'Web/API release is out of sync'
        : webEnabled === false ? 'Web/API drift while policy is marked paused (verify VPS config)'
          : 'Web/API drift; the actual VPS rollout policy is unknown');
  if (!asObject(android) || !Object.hasOwn(android, 'release')) {
    issue('critical', 'android-feed', 'Android update endpoint missing or invalid');
  } else if (android.release === null) {
    issue('warning', 'android-not-advertised', 'No signed Android update currently advertised');
  } else {
    const release = android.release;
    const expected = 'https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android/apk/KnowMe-' +
      release?.version + '-preview.apk';
    if (!asObject(release) || !VERSION.test(release.version || '') ||
        !Number.isSafeInteger(release.versionCode) || release.versionCode < 1 ||
        !HEX.test(release.sha256 || '') || release.url !== expected)
      issue('critical', 'android-manifest', 'Unsafe Android manifest or noncanonical APK URL');
    else if (validApi && api.version !== release.version)
      issue('warning', 'android-version-drift', 'Android update version differs from API release');
  }
  const status = issues.some(x => x.severity === 'critical') ? 'critical' : issues.length ? 'degraded' : 'healthy';
  return {
    status,
    webPolicy: webEnabled === true ? 'enabled' : webEnabled === false ? 'paused-unverified' : 'unknown',
    webPolicySource: 'operator-configured; not verified against VPS runtime',
    issues,
    observed: {
      api: validApi ? { commit: api.commit, version: api.version } : null,
      web: validWeb ? { commit: web.commit, version: web.version } : null,
      ready: ready?.status ?? null,
      android: asObject(android?.release) ? { version: android.release.version, versionCode: android.release.versionCode } : null,
    },
    disclaimer: 'Read-only metadata check; APK bytes, signing, delivery and device installation not verified.',
  };
}

export async function getSafeJson(url, fetchImpl = fetch) {
  if (!Object.values(ENDPOINTS).includes(url)) throw new Error('Disallowed release audit endpoint');
  const response = await fetchImpl(url, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/json', 'Cache-Control': 'no-store' },
  });
  if (response?.status !== 200) throw new Error('HTTP ' + (response?.status ?? 'unavailable'));
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type') || ''))
    throw new Error('Expected JSON content-type');
  const length = response.headers?.get?.('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 65536)) throw new Error('JSON response oversized');
  let text;
  if (typeof response.body?.getReader === 'function') {
    // Bound memory while streaming; a malicious or broken origin may lie about Content-Length.
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 65536) {
          await reader.cancel();
          throw new Error('JSON response oversized');
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    text = Buffer.concat(chunks).toString('utf8');
  } else {
    text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > 65536) throw new Error('JSON response oversized');
  }
  return JSON.parse(text);
}

export async function probeReleaseHealth({ fetchImpl = fetch, webEnabled = null } = {}) {
  const entries = await Promise.all(Object.entries(ENDPOINTS).map(async ([name, url]) => {
    try { return [name, { value: await getSafeJson(url, fetchImpl) }]; }
    catch (error) { return [name, { error: String(error?.message || error) }]; }
  }));
  const results = Object.fromEntries(entries);
  const report = evaluateReleaseHealth(Object.fromEntries(
    Object.entries(results).map(([name, r]) => [name, r.value ?? null])), { webEnabled });
  report.checkedAt = new Date().toISOString();
  report.endpoints = Object.fromEntries(Object.entries(results).map(([name, r]) =>
    [name, r.error ? { ok: false, error: r.error } : { ok: true }]));
  return report;
}

async function main() {
  const report = await probeReleaseHealth({ webEnabled: parseWebPolicy(process.env.KNOWME_WEB_DEPLOY_ENABLED) });
  const serialized = JSON.stringify(report, null, 2) + '\n';
  console.log(serialized);
  if (process.env.KNOWME_RELEASE_AUDIT_OUTPUT) {
    mkdirSync(dirname(process.env.KNOWME_RELEASE_AUDIT_OUTPUT), { recursive: true });
    writeFileSync(process.env.KNOWME_RELEASE_AUDIT_OUTPUT, serialized, { mode: 0o600 });
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = ['# KnowMe release audit', '', '**Result:** ' + report.status,
      '**Web rollout policy:** ' + report.webPolicy + ' (not VPS-attested)', '',
      ...report.issues.map(x => '- **' + x.severity + ' / ' + x.code + '** — ' + x.detail),
      '', report.disclaimer].join('\n') + '\n';
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });
  }
  if (report.status === 'critical') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === 'file://' + process.argv[1])
  main().catch(error => { console.error(error); process.exitCode = 1; });

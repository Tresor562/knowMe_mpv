import test from 'node:test';
import assert from 'node:assert/strict';
import { ENDPOINTS, evaluateReleaseHealth, getSafeJson, probeReleaseHealth, parseWebPolicy } from './knowme-release-health-audit.mjs';

const sha = 'a'.repeat(40);
const api = { platform: 'api', commit: sha, version: '1.1.8', experienceRevision: '2026-10-17.1' };
const web = { ...api, platform: 'web' };
const ready = { status: 'ready', checks: { database: 'up' } };
const android = { release: { version: '1.1.8', versionCode: 10800, sha256: 'b'.repeat(64),
  url: 'https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android/apk/KnowMe-1.1.8-preview.apk' } };
const ok = () => ({ api, web, vercel: { ...web }, ready, android });
const codes = report => report.issues.map(x => x.code);

test('healthy API + Web + Android feed is not misreported as degraded', () => {
  assert.equal(evaluateReleaseHealth(ok(), { webEnabled: true }).status, 'healthy');
});
test('intentional Web freeze is explicitly visible, but fails when rollout is enabled', () => {
  const state = { ...ok(), web: { ...web, commit: 'c'.repeat(40) } };
  const paused = evaluateReleaseHealth(state, { webEnabled: false });
  assert.equal(paused.status, 'degraded');
  assert.ok(codes(paused).includes('web-freeze'));
  assert.equal(evaluateReleaseHealth(state, { webEnabled: true }).status, 'critical');
});
test('database outage blocks deployment proof even while Web rollout is paused', () => {
  const report = evaluateReleaseHealth({ ...ok(), ready: { status: 'ready', checks: { database: 'down' } } });
  assert.ok(codes(report).includes('api-not-ready'));
});
test('missing Web is critical only if Web rollout is enabled', () => {
  assert.equal(evaluateReleaseHealth({ ...ok(), web: null }).status, 'degraded');
  assert.equal(evaluateReleaseHealth({ ...ok(), web: null }, { webEnabled: true }).status, 'critical');
});
test('Android feed without release is not proof an APK was published', () => {
  assert.ok(codes(evaluateReleaseHealth({ ...ok(), android: { release: null } })).includes('android-not-advertised'));
  assert.ok(codes(evaluateReleaseHealth({ ...ok(), android: null })).includes('android-feed'));
});
test('tampered APK download URL and invalid hash fail closed', () => {
  const feed = { release: { ...android.release, url: 'https://attacker.test/fake.apk', sha256: 'bad' } };
  assert.equal(evaluateReleaseHealth({ ...ok(), android: feed }).status, 'critical');
});
test('unapproved endpoints do not start network calls', async () => {
  await assert.rejects(getSafeJson('https://attacker.test/', () => assert.fail('network called')), /Disallowed/);
});
test('HTTP, content type and oversized responses fail closed', async () => {
  const response = (text, status = 200, type = 'application/json') => ({
    status, headers: { get: key => key === 'content-type' ? type : null }, text: async () => text,
  });
  await assert.rejects(getSafeJson(ENDPOINTS.api, async () => response('{}', 503)), /HTTP 503/);
  await assert.rejects(getSafeJson(ENDPOINTS.api, async () => response('<html>', 200, 'text/html')), /content-type/);
  await assert.rejects(getSafeJson(ENDPOINTS.api, async () => response('x'.repeat(65537))), /oversized/);
});

test('streamed endpoint cannot allocate unbounded JSON when Content-Length is missing', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(65537));
      controller.close();
    },
  });
  await assert.rejects(getSafeJson(ENDPOINTS.api, async () => ({
    status: 200,
    headers: { get: key => key === 'content-type' ? 'application/json' : null },
    body: stream,
    text: () => assert.fail('Should read bounded stream instead of text'),
  })), /oversized/);
});

test('network timeout on readiness yields critical report but preserves other evidence', async () => {
  const data = { [ENDPOINTS.api]: api, [ENDPOINTS.web]: web,
    [ENDPOINTS.vercel]: web, [ENDPOINTS.android]: android };
  const report = await probeReleaseHealth({ fetchImpl: async url => {
    if (url === ENDPOINTS.ready) throw new Error('timeout');
    return { status: 200,
      headers: { get: key => key === 'content-type' ? 'application/json' : null },
      text: async () => JSON.stringify(data[url]) };
  } });
  assert.equal(report.status, 'critical');
  assert.equal(report.endpoints.ready.error, 'timeout');
  assert.equal(report.endpoints.web.ok, true);
});

test('unknown Web rollout policy does not invent proof of a VPS freeze', () => {
  assert.equal(parseWebPolicy(undefined), null);
  assert.equal(parseWebPolicy('invalid'), null);
  assert.equal(parseWebPolicy('true'), true);
  assert.equal(parseWebPolicy('false'), false);
  const matching = evaluateReleaseHealth(ok());
  assert.equal(matching.status, 'degraded');
  assert.equal(matching.webPolicy, 'unknown');
  assert.ok(codes(matching).includes('web-policy-unknown'));
  const drift = evaluateReleaseHealth({ ...ok(), web: { ...web, commit: 'd'.repeat(40) } });
  assert.ok(codes(drift).includes('web-policy-unknown-drift'));
  assert.ok(!codes(drift).includes('web-freeze'));
});

test('Vercel and VPS are audited separately without treating a divergent Vercel build as a healthy release', () => {
  const good = evaluateReleaseHealth(ok(), { webEnabled: true });
  assert.equal(good.status, 'healthy');
  assert.deepEqual(good.observed.vercel, { commit: sha, version: '1.1.8' });
  const divergent = evaluateReleaseHealth({
    ...ok(), vercel: { ...web, commit: 'c'.repeat(40) },
  }, { webEnabled: true });
  assert.equal(divergent.status, 'degraded');
  assert.ok(codes(divergent).includes('vercel-api-drift'));
  const unavailable = evaluateReleaseHealth({ ...ok(), vercel: null }, { webEnabled: true });
  assert.ok(codes(unavailable).includes('vercel-identity'));
});

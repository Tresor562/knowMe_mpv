import assert from 'node:assert/strict';
import test from 'node:test';
import { assessPlatformSync, parsePlatformIdentity, probeErrorMessage } from './platform-sync-model.ts';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const apk = { version: '1.1.1', experienceRevision: '2026-10', commit: SHA_A };
const web = { platform: 'web' as const, version: apk.version, experienceRevision: apk.experienceRevision, commit: SHA_A };
const api = { ...web, platform: 'api' as const };

test('independent probe failures never claim a synchronized APK', () => {
  assert.equal(assessPlatformSync(apk, web, null), 'unavailable');
  assert.equal(assessPlatformSync(apk, null, api), 'unavailable');
});

test('identical versions but divergent commit are not synchronized', () => {
  assert.equal(assessPlatformSync(apk, { ...web, commit: SHA_B }, api), 'outdated');
});

test('missing API or APK commit remains unverified, never green', () => {
  assert.equal(assessPlatformSync(apk, web, { ...api, commit: null }), 'unverified');
  assert.equal(assessPlatformSync({ ...apk, commit: null }, web, api), 'unverified');
});

test('sync requires matching version, revision and commit for all three', () => {
  assert.equal(assessPlatformSync(apk, web, api), 'synchronized');
  assert.equal(assessPlatformSync(apk, { ...web, version: '1.1.0' }, api), 'outdated');
  assert.equal(assessPlatformSync(apk, web, { ...api, experienceRevision: '2026-09' }), 'outdated');
});

test('invalid route payload is rejected instead of being trusted', () => {
  assert.throws(() => parsePlatformIdentity({ ...web, platform: 'api' }, 'web'));
  assert.throws(() => parsePlatformIdentity({ ...web, commit: 'not-a-commit' }, 'web'));
  assert.deepEqual(parsePlatformIdentity(web, 'web'), web);
});

test('route 404 has an explicit actionable message', () => {
  assert.match(probeErrorMessage('api', Object.assign(new Error('Resource not found'), { status: 404 })), /API.*HTTP 404/);
  assert.match(probeErrorMessage('web', Object.assign(new Error('Not Found'), { status: 404 })), /Web.*HTTP 404/);
});

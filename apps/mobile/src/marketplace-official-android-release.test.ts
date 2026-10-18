import assert from 'node:assert/strict';
import test from 'node:test';
import { marketplaceOfficialAndroidRelease } from './marketplace-official-android-release.ts';

const version = '1.1.8';
const url = 'https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android/apk/KnowMe-1.1.8-preview.apk';
const sha256 = 'abcdef0123456789'.repeat(4);

test('accepts only a fully specified self-hosted KnowMe release', () => {
  const release = marketplaceOfficialAndroidRelease({
    release: { version, versionCode: 11, url, sha256: sha256.toUpperCase(), notes: 'Update', required: false }
  });
  assert.equal(release?.version, version);
  assert.equal(release?.sha256, sha256);
  assert.equal(release?.versionCode, 11);
});

test('does not trust matching APK paths on third-party hosts', () => {
  assert.equal(marketplaceOfficialAndroidRelease({
    release: { version, versionCode: 11, url: url.replace('31-56-85-53.sslip.io', 'fake.example'), sha256 }
  }), null);
});

test('fails closed on mismatched version, malformed digest and absent publication', () => {
  assert.equal(marketplaceOfficialAndroidRelease({ release: null }), null);
  assert.equal(marketplaceOfficialAndroidRelease({
    release: { version: '1.1.9', versionCode: 12, url, sha256 }
  }), null);
  assert.equal(marketplaceOfficialAndroidRelease({
    release: { version, versionCode: 11, url, sha256: 'not-a-digest' }
  }), null);
});

test('truncates untrusted update notes without mutating the response', () => {
  const original = { release: { version, versionCode: 11, url, sha256, notes: 'x'.repeat(900), required: true } };
  const release = marketplaceOfficialAndroidRelease(original);
  assert.equal(release?.notes.length, 500);
  assert.equal(release?.required, true);
  assert.equal(original.release.notes.length, 900);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { computeAndroidAutoVersion, stampAndroidAutoVersion } from './prepare-android-auto-version.mjs';

test('automatic APK version stays monotonic and preserves MAJOR.MINOR', () => {
  assert.deepEqual(computeAndroidAutoVersion(51, '1.1.8', 10),
    { version: '1.1.10051', versionCode: 10051 });
  assert.deepEqual(computeAndroidAutoVersion(52, '1.1.8', 10),
    { version: '1.1.10052', versionCode: 10052 });
  assert.throws(() => computeAndroidAutoVersion(0, '1.1.8', 10));
  assert.throws(() => computeAndroidAutoVersion(1, '1.1.8', 11000));
});

test('CI-only stamping produces a single APK release identity without modifying committed sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'knowme-auto-version-'));
  const content = {
    'packages/link-contract/src/platform-sync.json': { productVersion: '1.1.8', features: [] },
    'apps/web/package.json': { name: '@knowme/web', version: '1.1.8' },
    'apps/api/package.json': { name: '@knowme/api', version: '1.1.8' },
    'apps/mobile/app.json': { expo: { version: '1.1.8', android: { versionCode: 10 } } }
  };
  try {
    for (const [filename, data] of Object.entries(content)) {
      mkdirSync(dirname(join(root, filename)), { recursive: true });
      writeFileSync(join(root, filename), JSON.stringify(data));
    }
    const sha = '0123456789abcdef0123456789abcdef01234567';
    const meta = stampAndroidAutoVersion(root, '15', sha);
    assert.equal(meta.version, '1.1.10015');
    assert.equal(meta.versionCode, 10015);
    assert.equal(meta.sourceSha, sha);
    assert.equal(JSON.parse(readFileSync(join(root, 'apps/mobile/app.json'))).expo.android.versionCode, 10015);
    for (const name of Object.keys(content).filter(n => n !== 'apps/mobile/app.json')) {
      const record = JSON.parse(readFileSync(join(root, name)));
      assert.equal(name.includes('platform-sync') ? record.productVersion : record.version, '1.1.10015');
    }
    assert.deepEqual(JSON.parse(readFileSync(join(root, '.knowme-android-release.json'))), meta);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

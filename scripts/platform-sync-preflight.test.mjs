import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditPlatformSync } from './platform-sync-preflight.mjs';

const manifest = JSON.parse(readFileSync(new URL('../packages/link-contract/src/platform-sync.json', import.meta.url), 'utf8'));

test('KnowMe platforms use the same product version and auditable feature sources', () => {
  const report = auditPlatformSync(manifest);
  assert.deepEqual(report.errors, []);
  assert.ok(report.missing.includes('stories.photo'));
  assert.ok(report.missing.includes('stories.video'));
});

test('release cannot ship while platform parity gaps are recorded', () => {
  const report = auditPlatformSync(manifest, { strict: true });
  assert.ok(report.errors.some((value) => value.includes('Release blocked')));
});

test('a new untracked feature source is rejected, not assumed to exist', () => {
  const altered = structuredClone(manifest);
  altered.features[0].android.evidence = 'apps/mobile/src/THIS_FILE_DOES_NOT_EXIST.tsx';
  assert.ok(auditPlatformSync(altered).errors.some((item) => item.includes('evidence is missing')));
});

test('a version mismatch in one platform is not silently accepted', () => {
  const altered = structuredClone(manifest);
  altered.productVersion = '2.9.1';
  assert.ok(auditPlatformSync(altered).errors.some((item) => item.includes('version')));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { requiredEvidenceForScope, validateMarketReleaseEvidence } from './market-release-evidence-preflight.mjs';

const commit = 'a'.repeat(40);
const now = new Date('2026-08-26T02:00:00.000Z');

function item(id) {
  return {
    id,
    status: 'VERIFIED',
    verifiedAt: '2026-08-26T01:30:00.000Z',
    verifier: 'release-reviewer',
    evidenceRef: `evidence://${id}`,
  };
}

function manifest(scope = 'WEB_V1') {
  return {
    schemaVersion: 1,
    scope,
    releaseCommit: commit,
    evidence: requiredEvidenceForScope(scope).map(item),
  };
}

test('accepts a complete WEB_V1 evidence manifest', () => {
  const result = validateMarketReleaseEvidence(manifest(), { expectedCommit: commit, now });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('requires physical and store evidence for FULL scope', () => {
  const full = manifest('FULL');
  assert.ok(full.evidence.some((entry) => entry.id === 'ios_physical_validation'));
  assert.ok(full.evidence.some((entry) => entry.id === 'android_store_submission'));
  assert.equal(validateMarketReleaseEvidence(full, { expectedCommit: commit, now }).ok, true);
});

test('does not require mobile/store evidence for a WEB_V1 release', () => {
  const web = manifest('WEB_V1');
  assert.equal(web.evidence.some((entry) => entry.id === 'ios_store_submission'), false);
  assert.equal(validateMarketReleaseEvidence(web, { expectedCommit: commit, now }).ok, true);
});

test('fails when required evidence is missing or pending', () => {
  const value = manifest();
  value.evidence = value.evidence.filter((entry) => entry.id !== 'backup_restore_drill');
  value.evidence.find((entry) => entry.id === 'production_tls_domain').status = 'PENDING';
  const result = validateMarketReleaseEvidence(value, { expectedCommit: commit, now });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('backup_restore_drill')));
  assert.ok(result.errors.some((error) => error.includes('production_tls_domain.status')));
});

test('binds evidence to the exact release commit', () => {
  const result = validateMarketReleaseEvidence(manifest(), { expectedCommit: 'b'.repeat(40), now });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('releaseCommit does not match the commit being released.'));
});

test('fails closed when the expected release commit is missing', () => {
  const result = validateMarketReleaseEvidence(manifest(), { now });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes('expected release commit must be an explicit lowercase 40-character Git commit SHA.'),
  );
});

test('rejects a malformed or non-canonical expected release commit', () => {
  for (const expectedCommit of ['ABC', 'A'.repeat(40), 'a'.repeat(39), ` ${commit} `]) {
    const result = validateMarketReleaseEvidence(manifest(), { expectedCommit, now });
    if (expectedCommit === ` ${commit} `) {
      assert.equal(result.ok, true);
    } else {
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.includes('expected release commit must be an explicit lowercase 40-character Git commit SHA.'),
      );
    }
  }
});

test('rejects duplicate evidence ids', () => {
  const value = manifest();
  value.evidence.push(item('production_tls_domain'));
  const result = validateMarketReleaseEvidence(value, { expectedCommit: commit, now });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Duplicate evidence id')));
});

test('rejects weak evidence metadata and future timestamps', () => {
  const value = manifest();
  const target = value.evidence[0];
  target.verifier = ' ';
  target.evidenceRef = 'short';
  target.verifiedAt = '2026-08-26T03:00:00.000Z';
  const result = validateMarketReleaseEvidence(value, { expectedCommit: commit, now });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('.verifier')));
  assert.ok(result.errors.some((error) => error.includes('.evidenceRef')));
  assert.ok(result.errors.some((error) => error.includes('must not be in the future')));
});

test('rejects unknown scope and non-canonical commit ids', () => {
  const value = manifest();
  value.scope = 'MOBILE_ONLY';
  value.releaseCommit = 'ABC';
  const result = validateMarketReleaseEvidence(value, { expectedCommit: commit, now });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('scope must be')));
  assert.ok(result.errors.some((error) => error.includes('releaseCommit')));
});

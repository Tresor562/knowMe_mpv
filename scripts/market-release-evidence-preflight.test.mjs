import assert from 'node:assert/strict';
import test from 'node:test';
import { requiredEvidenceForScope, validateMarketReleaseEvidence } from './market-release-evidence-preflight.mjs';

const commit = 'a'.repeat(40);
const releaseVersion = '1.0.0-rc.1';
const now = new Date('2026-08-26T02:00:00.000Z');

function item(id) {
  return {
    id,
    status: 'VERIFIED',
    verifiedAt: '2026-08-26T01:30:00.000Z',
    validUntil: '2026-08-27T01:30:00.000Z',
    verifier: 'release-reviewer',
    evidenceRef: `evidence://${id}`,
    evidenceSha256: 'b'.repeat(64),
  };
}

function manifest(scope = 'WEB_V1') {
  return {
    schemaVersion: 2,
    scope,
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion,
    evidence: requiredEvidenceForScope(scope).map(item),
  };
}

function validate(value, options = {}) {
  return validateMarketReleaseEvidence(value, {
    expectedCommit: commit,
    expectedReleaseVersion: releaseVersion,
    now,
    ...options,
  });
}

test('accepts a complete WEB_V1 evidence manifest', () => {
  const result = validate(manifest());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('requires physical and store evidence for FULL scope', () => {
  const full = manifest('FULL');
  assert.ok(full.evidence.some((entry) => entry.id === 'ios_physical_validation'));
  assert.ok(full.evidence.some((entry) => entry.id === 'android_store_submission'));
  assert.equal(validate(full).ok, true);
});

test('does not require mobile/store evidence for a WEB_V1 release', () => {
  const web = manifest('WEB_V1');
  assert.equal(web.evidence.some((entry) => entry.id === 'ios_store_submission'), false);
  assert.equal(validate(web).ok, true);
});

test('fails when required evidence is missing or pending', () => {
  const value = manifest();
  value.evidence = value.evidence.filter((entry) => entry.id !== 'backup_restore_drill');
  value.evidence.find((entry) => entry.id === 'production_tls_domain').status = 'PENDING';
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('backup_restore_drill')));
  assert.ok(result.errors.some((error) => error.includes('production_tls_domain.status')));
});

test('binds evidence to the exact release commit', () => {
  const result = validate(manifest(), { expectedCommit: 'b'.repeat(40) });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('releaseCommit does not match the commit being released.'));
});

test('fails closed when the expected release commit is missing', () => {
  const result = validateMarketReleaseEvidence(manifest(), { expectedReleaseVersion: releaseVersion, now });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('expected release commit must be an explicit lowercase 40-character Git commit SHA.'));
});

test('binds evidence to an explicit production release version', () => {
  const wrongEnvironment = manifest();
  wrongEnvironment.environment = 'STAGING';
  const environmentResult = validate(wrongEnvironment);
  assert.equal(environmentResult.ok, false);
  assert.ok(environmentResult.errors.includes('environment must equal PRODUCTION.'));

  const wrongVersion = manifest();
  wrongVersion.releaseVersion = '1.0.1';
  const versionResult = validate(wrongVersion);
  assert.equal(versionResult.ok, false);
  assert.ok(versionResult.errors.includes('releaseVersion does not match the version being released.'));
});

test('fails closed when the expected release version is missing or non-canonical', () => {
  for (const expectedReleaseVersion of [undefined, '01.0.0', '1.0', '1.0.0+build.1', ' 1.0.0 ']) {
    const result = validateMarketReleaseEvidence(manifest(), { expectedCommit: commit, expectedReleaseVersion, now });
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes('expected release version must be an explicit canonical SemVer version.'));
  }
});

test('rejects non-canonical manifest release versions', () => {
  for (const value of ['01.0.0', '1.0', '1.0.0+build.1', ' 1.0.0 ', 'v1.0.0']) {
    const candidate = manifest();
    candidate.releaseVersion = value;
    const result = validate(candidate);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('releaseVersion')));
  }
});

test('rejects duplicate evidence ids', () => {
  const value = manifest();
  value.evidence.push(item('production_tls_domain'));
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Duplicate evidence id')));
});

test('rejects weak evidence metadata and future timestamps', () => {
  const value = manifest();
  const target = value.evidence[0];
  target.verifier = ' ';
  target.evidenceRef = 'short';
  target.verifiedAt = '2026-08-26T03:00:00.000Z';
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('.verifier')));
  assert.ok(result.errors.some((error) => error.includes('.evidenceRef')));
  assert.ok(result.errors.some((error) => error.includes('must not be in the future')));
});

test('requires and enforces a current validity deadline', () => {
  const missing = manifest();
  delete missing.evidence[0].validUntil;
  assert.equal(validate(missing).ok, false);

  const expired = manifest();
  expired.evidence[0].validUntil = '2026-08-26T01:59:59.999Z';
  const expiredResult = validate(expired);
  assert.ok(expiredResult.errors.some((error) => error.includes('has expired')));
});

test('requires a canonical SHA-256 digest for every retained evidence artifact', () => {
  for (const digest of [undefined, 'ABC', 'A'.repeat(64), 'a'.repeat(63), ` ${'a'.repeat(64)} `]) {
    const value = manifest();
    if (digest === undefined) delete value.evidence[0].evidenceSha256;
    else value.evidence[0].evidenceSha256 = digest;
    const result = validate(value);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('evidenceSha256')));
  }
});

test('rejects unknown scope, old schema and non-canonical commit ids', () => {
  const value = manifest();
  value.schemaVersion = 1;
  value.scope = 'MOBILE_ONLY';
  value.releaseCommit = 'ABC';
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('schemaVersion')));
  assert.ok(result.errors.some((error) => error.includes('scope must be')));
  assert.ok(result.errors.some((error) => error.includes('releaseCommit')));
});

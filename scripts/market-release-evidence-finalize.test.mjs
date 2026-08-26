import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { finalizeMarketReleaseEvidence } from './market-release-evidence-finalize.mjs';
import { requiredEvidenceForScope, validateMarketReleaseEvidence } from './market-release-evidence-preflight.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const signingKeyId = 'release-key-1';
const signingKey = 'k'.repeat(48);
const now = new Date('2026-08-26T22:30:00.000Z');
const zero = '0'.repeat(64);
const artifactSha = 'b'.repeat(64);

function pending(id) {
  return { id, status: 'PENDING', verifiedAt: null, validUntil: null, verifier: null, evidenceRef: null, evidenceSha256: null };
}

function item(id) {
  return {
    id,
    status: 'VERIFIED',
    verifiedAt: '2026-08-26T22:25:00.000Z',
    validUntil: '2026-09-02T22:25:00.000Z',
    verifier: 'release-operator',
    evidenceRef: `evidence://release/${id}.json`,
    evidenceSha256: artifactSha,
  };
}

function manifest(scope = 'WEB_V1') {
  return {
    schemaVersion: 4,
    scope,
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion: version,
    signingKeyId,
    evidence: requiredEvidenceForScope(scope).map(pending),
    manifestHmacSha256: zero,
  };
}

function finalize(source = manifest(), items = requiredEvidenceForScope(source.scope).map(item), overrides = {}) {
  return finalizeMarketReleaseEvidence(source, items, {
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
    ...overrides,
  });
}

test('atomically applies, signs, revalidates, and hashes WEB_V1 evidence', () => {
  const source = manifest();
  const result = finalize(source);
  assert.equal(result.ok, true);
  assert.equal(source.evidence.every((entry) => entry.status === 'PENDING'), true);
  assert.notEqual(result.manifest.manifestHmacSha256, zero);
  assert.equal(result.manifest.evidence.every((entry) => entry.status === 'VERIFIED'), true);
  assert.equal(createHash('sha256').update(result.bytes).digest('hex'), result.sha256);

  const validation = validateMarketReleaseEvidence(result.manifest, {
    expectedCommit: commit,
    expectedReleaseVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
  });
  assert.equal(validation.ok, true);
});

test('fails before signing when one pending item is missing', () => {
  const items = requiredEvidenceForScope('WEB_V1').slice(1).map(item);
  const result = finalize(manifest(), items);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /missing evidence items/);
});

test('fails closed on release commit mismatch', () => {
  const result = finalize(manifest(), undefined, { expectedCommit: 'c'.repeat(40) });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /releaseCommit does not match|commit/);
});

test('fails closed on release version mismatch', () => {
  const result = finalize(manifest(), undefined, { expectedVersion: '1.0.1' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /releaseVersion does not match|version/);
});

test('fails closed on signing key id mismatch', () => {
  const result = finalize(manifest(), undefined, { expectedSigningKeyId: 'release-key-2' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /signingKeyId does not match|signing key/);
});

test('fails closed with a weak signing key', () => {
  const result = finalize(manifest(), undefined, { signingKey: 'too-short' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /signing key must be at least/);
});

test('preserves FULL scope and signs all required evidence', () => {
  const source = manifest('FULL');
  const result = finalize(source, requiredEvidenceForScope('FULL').map(item));
  assert.equal(result.ok, true);
  assert.equal(result.manifest.evidence.length, requiredEvidenceForScope('FULL').length);
  assert.equal(result.manifest.evidence.every((entry) => entry.status === 'VERIFIED'), true);
});

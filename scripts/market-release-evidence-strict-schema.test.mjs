import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeMarketReleaseEvidenceHmac,
  requiredEvidenceForScope,
  validateMarketReleaseEvidence,
} from './market-release-evidence-preflight.mjs';

const commit = 'a'.repeat(40);
const releaseVersion = '1.0.0-rc.1';
const signingKey = 'release-evidence-signing-key-0000001';
const signingKeyId = 'release-evidence-2026-08';
const now = new Date('2026-08-26T02:00:00.000Z');

function evidence(id) {
  return {
    id,
    status: 'VERIFIED',
    verifiedAt: '2026-08-26T01:00:00.000Z',
    validUntil: '2026-09-26T01:00:00.000Z',
    verifier: 'release-owner',
    evidenceRef: `evidence://${id}`,
    evidenceSha256: 'b'.repeat(64),
  };
}

function manifest(scope = 'WEB_V1') {
  const value = {
    schemaVersion: 4,
    scope,
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion,
    signingKeyId,
    evidence: requiredEvidenceForScope(scope).map(evidence),
  };
  value.manifestHmacSha256 = computeMarketReleaseEvidenceHmac(value, signingKey);
  return value;
}

function validate(value) {
  return validateMarketReleaseEvidence(value, {
    expectedCommit: commit,
    expectedReleaseVersion: releaseVersion,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
  });
}

test('rejects unknown top-level manifest fields even when re-signed', () => {
  const value = manifest();
  value.approved = true;
  value.manifestHmacSha256 = computeMarketReleaseEvidenceHmac(value, signingKey);
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('Unknown release evidence manifest field(s): approved.'));
});

test('rejects unknown evidence fields even when re-signed', () => {
  const value = manifest();
  value.evidence[0].approvalNote = 'ignored by old validator';
  value.manifestHmacSha256 = computeMarketReleaseEvidenceHmac(value, signingKey);
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('contains unknown field(s): approvalNote')));
});

test('rejects unexpected evidence ids for WEB_V1', () => {
  const value = manifest();
  value.evidence.push(evidence('ios_store_submission'));
  value.manifestHmacSha256 = computeMarketReleaseEvidenceHmac(value, signingKey);
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('Unexpected release evidence id for WEB_V1: ios_store_submission.'));
});

test('accepts the exact documented WEB_V1 evidence contract', () => {
  assert.equal(validate(manifest()).ok, true);
});

test('accepts the exact documented FULL evidence contract', () => {
  assert.equal(validate(manifest('FULL')).ok, true);
});

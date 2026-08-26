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

function manifest() {
  const value = {
    schemaVersion: 4,
    scope: 'WEB_V1',
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion,
    signingKeyId,
    evidence: requiredEvidenceForScope('WEB_V1').map(evidence),
  };
  value.manifestHmacSha256 = computeMarketReleaseEvidenceHmac(value, signingKey);
  return value;
}

function validate(value) {
  value.manifestHmacSha256 = computeMarketReleaseEvidenceHmac(value, signingKey);
  return validateMarketReleaseEvidence(value, {
    expectedCommit: commit,
    expectedReleaseVersion: releaseVersion,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
  });
}

test('accepts canonical verifier and absolute evidence URI metadata', () => {
  assert.equal(validate(manifest()).ok, true);
});

test('rejects verifier metadata with hidden whitespace', () => {
  const value = manifest();
  value.evidence[0].verifier = ' release-owner ';
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('.verifier must be canonical')));
});

test('rejects verifier metadata with control characters', () => {
  const value = manifest();
  value.evidence[0].verifier = 'release-owner\nadmin';
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('.verifier must be canonical')));
});

test('rejects verifier metadata longer than 128 characters', () => {
  const value = manifest();
  value.evidence[0].verifier = 'v'.repeat(129);
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('.verifier must be canonical')));
});

test('rejects relative evidence references', () => {
  const value = manifest();
  value.evidence[0].evidenceRef = './evidence/report.pdf';
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('.evidenceRef must be a canonical credential-free HTTPS or evidence URI')));
});

test('rejects evidence references with embedded credentials', () => {
  const value = manifest();
  value.evidence[0].evidenceRef = 'https://user:secret@example.com/report';
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('.evidenceRef must be a canonical credential-free HTTPS or evidence URI')));
});

test('rejects evidence references with hidden whitespace or control characters', () => {
  const withWhitespace = manifest();
  withWhitespace.evidence[0].evidenceRef = ' https://example.com/report ';
  assert.equal(validate(withWhitespace).ok, false);

  const withControl = manifest();
  withControl.evidence[0].evidenceRef = 'https://example.com/report\nnext';
  assert.equal(validate(withControl).ok, false);
});

test('rejects oversized evidence references', () => {
  const value = manifest();
  value.evidence[0].evidenceRef = `https://example.com/${'a'.repeat(2030)}`;
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('.evidenceRef must be a canonical credential-free HTTPS or evidence URI')));
});

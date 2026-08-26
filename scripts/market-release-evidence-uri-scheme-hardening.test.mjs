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
    evidenceRef: `https://evidence.example/${id}`,
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

test('accepts stable credential-free HTTPS evidence references', () => {
  assert.equal(validate(manifest()).ok, true);
});

test('preserves the internal evidence registry URI scheme', () => {
  const value = manifest();
  value.evidence[0].evidenceRef = 'evidence://production_tls_domain/report';
  assert.equal(validate(value).ok, true);
});

test('rejects unsafe or non-retained evidence URI schemes', () => {
  for (const evidenceRef of [
    'http://evidence.example/report',
    'file:///tmp/report.pdf',
    'data:text/plain,verified',
    'javascript:alert(1)',
    'ftp://evidence.example/report',
  ]) {
    const value = manifest();
    value.evidence[0].evidenceRef = evidenceRef;
    const result = validate(value);
    assert.equal(result.ok, false, evidenceRef);
    assert.ok(result.errors.some((error) => error.includes('.evidenceRef must be a canonical credential-free HTTPS or evidence URI')), evidenceRef);
  }
});

test('rejects evidence references carrying query strings or fragments', () => {
  for (const evidenceRef of [
    'https://evidence.example/report?token=temporary-secret',
    'https://evidence.example/report#section',
    'evidence://production_tls_domain/report?token=temporary-secret',
    'evidence://production_tls_domain/report#section',
  ]) {
    const value = manifest();
    value.evidence[0].evidenceRef = evidenceRef;
    const result = validate(value);
    assert.equal(result.ok, false, evidenceRef);
  }
});

test('rejects hostless HTTPS and evidence references', () => {
  for (const evidenceRef of ['https://', 'evidence:report']) {
    const value = manifest();
    value.evidence[0].evidenceRef = evidenceRef;
    assert.equal(validate(value).ok, false, evidenceRef);
  }
});

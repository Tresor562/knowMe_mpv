import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';
import { finalizeMarketReleaseEvidence } from './market-release-evidence-finalize.mjs';
import { buildMarketReleaseEvidenceBundleReceipt } from './market-release-evidence-bundle-receipt.mjs';
import { validateRetainedMarketReleaseBundle } from './market-release-evidence-retained-bundle-preflight.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const signingKeyId = 'release-key-1';
const signingKey = 'k'.repeat(48);
const now = new Date('2026-08-27T10:00:00.000Z');
const manifestPath = '/tmp/knowme-release.signed.json';
const digestPath = '/tmp/knowme-release.signed.sha256';
const receiptPath = '/tmp/knowme-release.receipt.json';
const artifactSha = 'b'.repeat(64);

function pending(id) {
  return {
    id,
    status: 'PENDING',
    verifiedAt: null,
    validUntil: null,
    verifier: null,
    evidenceRef: null,
    evidenceSha256: null,
  };
}

function item(id) {
  return {
    id,
    status: 'VERIFIED',
    verifiedAt: '2026-08-27T08:00:00.000Z',
    validUntil: '2026-09-03T08:00:00.000Z',
    verifier: 'release-operator',
    evidenceRef: `evidence://release/${id}.json`,
    evidenceSha256: artifactSha,
  };
}

function fixture() {
  const source = {
    schemaVersion: 4,
    scope: 'WEB_V1',
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion: version,
    signingKeyId,
    evidence: requiredEvidenceForScope('WEB_V1').map(pending),
    manifestHmacSha256: '0'.repeat(64),
  };
  const finalized = finalizeMarketReleaseEvidence(
    source,
    requiredEvidenceForScope('WEB_V1').map(item),
    {
      expectedCommit: commit,
      expectedVersion: version,
      expectedSigningKeyId: signingKeyId,
      signingKey,
      now,
    },
  );
  assert.equal(finalized.ok, true);
  const digestText = `${finalized.sha256}  ${manifestPath}\n`;
  const receipt = buildMarketReleaseEvidenceBundleReceipt({
    manifestBytes: finalized.bytes,
    digestText,
    manifestPath,
    digestPath,
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
  });
  assert.equal(receipt.ok, true);
  return { finalized, digestText, receipt };
}

function validate(overrides = {}) {
  const { finalized, digestText, receipt } = fixture();
  return validateRetainedMarketReleaseBundle({
    receiptBytes: receipt.bytes,
    manifestBytes: finalized.bytes,
    digestText,
    receiptPath,
    manifestPath,
    digestPath,
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    maxAgeHours: 24,
    now,
    ...overrides,
  });
}

test('passes only when the exact retained manifest, digest, and authenticated receipt agree', () => {
  const result = validate();
  assert.equal(result.ok, true);
  assert.equal(result.manifest?.releaseCommit, commit);
  assert.match(result.manifestSha256, /^[0-9a-f]{64}$/);
  assert.match(result.receiptSha256, /^[0-9a-f]{64}$/);
});

test('fails closed when any retained artifact path is missing', () => {
  for (const overrides of [
    { receiptPath: '' },
    { manifestPath: '' },
    { digestPath: '' },
  ]) {
    const result = validate(overrides);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' '), /explicit receipt, manifest, and digest paths/);
  }
});

test('rejects ambiguous reuse of one path for different release artifacts', () => {
  const result = validate({ digestPath: manifestPath });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must be distinct/);
});

test('rejects a retained digest that no longer matches the signed manifest bytes', () => {
  const { finalized, receipt } = fixture();
  const result = validateRetainedMarketReleaseBundle({
    receiptBytes: receipt.bytes,
    manifestBytes: finalized.bytes,
    digestText: `${'c'.repeat(64)}  ${manifestPath}\n`,
    receiptPath,
    manifestPath,
    digestPath,
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    maxAgeHours: 24,
    now,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /digest|SHA-256/);
});

test('rejects an authentic retained bundle when the receipt freshness policy is exceeded', () => {
  const oldNow = new Date('2026-08-27T08:00:00.000Z');
  const source = {
    schemaVersion: 4,
    scope: 'WEB_V1',
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion: version,
    signingKeyId,
    evidence: requiredEvidenceForScope('WEB_V1').map(pending),
    manifestHmacSha256: '0'.repeat(64),
  };
  const finalized = finalizeMarketReleaseEvidence(source, requiredEvidenceForScope('WEB_V1').map(item), {
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now: oldNow,
  });
  assert.equal(finalized.ok, true);
  const digestText = `${finalized.sha256}  ${manifestPath}\n`;
  const receipt = buildMarketReleaseEvidenceBundleReceipt({
    manifestBytes: finalized.bytes,
    digestText,
    manifestPath,
    digestPath,
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now: oldNow,
  });
  assert.equal(receipt.ok, true);

  const result = validateRetainedMarketReleaseBundle({
    receiptBytes: receipt.bytes,
    manifestBytes: finalized.bytes,
    digestText,
    receiptPath,
    manifestPath,
    digestPath,
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    maxAgeHours: 1,
    now,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /older than the allowed 1 hour freshness window/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';
import { finalizeMarketReleaseEvidence } from './market-release-evidence-finalize.mjs';
import { buildMarketReleaseEvidenceBundleReceipt } from './market-release-evidence-bundle-receipt.mjs';
import { verifyMarketReleaseEvidenceBundleReceipt } from './market-release-evidence-bundle-receipt-verify.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const signingKeyId = 'release-key-1';
const signingKey = 'k'.repeat(48);
const now = new Date('2026-08-27T02:30:00.000Z');
const artifactSha = 'b'.repeat(64);
const manifestPath = '/tmp/release-evidence.signed.json';
const digestPath = '/tmp/release-evidence.signed.sha256';

function pending(id) {
  return { id, status: 'PENDING', verifiedAt: null, validUntil: null, verifier: null, evidenceRef: null, evidenceSha256: null };
}

function item(id) {
  return {
    id,
    status: 'VERIFIED',
    verifiedAt: '2026-08-27T02:00:00.000Z',
    validUntil: '2026-09-03T02:00:00.000Z',
    verifier: 'release-operator',
    evidenceRef: `evidence://release/${id}.json`,
    evidenceSha256: artifactSha,
  };
}

function receiptBytes() {
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
    now,
  });
  assert.equal(finalized.ok, true);
  const receipt = buildMarketReleaseEvidenceBundleReceipt({
    manifestBytes: finalized.bytes,
    digestText: `${finalized.sha256}  ${manifestPath}\n`,
    manifestPath,
    digestPath,
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
  });
  assert.equal(receipt.ok, true);
  return receipt.bytes;
}

function verify(bytes, overrides = {}) {
  return verifyMarketReleaseEvidenceBundleReceipt({
    receiptBytes: bytes,
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
    ...overrides,
  });
}

test('accepts an authentic receipt bound to the expected release candidate', () => {
  const result = verify(receiptBytes());
  assert.equal(result.ok, true);
  assert.equal(result.receipt.schemaVersion, 2);
  assert.match(result.receipt.receiptHmacSha256, /^[0-9a-f]{64}$/);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
});

test('rejects a semantically tampered receipt even when JSON stays valid', () => {
  const parsed = JSON.parse(receiptBytes().toString('utf8'));
  parsed.scope = 'FULL';
  const result = verify(Buffer.from(`${JSON.stringify(parsed, null, 2)}\n`, 'utf8'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /HMAC does not match/);
});

test('rejects receipt candidate identity mismatches', () => {
  const result = verify(receiptBytes(), { expectedVersion: '1.0.1' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /releaseVersion does not match/);
});

test('rejects signing key id mismatches', () => {
  const result = verify(receiptBytes(), { expectedSigningKeyId: 'release-key-2' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /signingKeyId does not match/);
});

test('rejects unknown receipt fields even after attacker preserves the old HMAC', () => {
  const parsed = JSON.parse(receiptBytes().toString('utf8'));
  parsed.note = 'looks harmless';
  const result = verify(Buffer.from(`${JSON.stringify(parsed, null, 2)}\n`, 'utf8'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Unknown verification receipt field/);
});

test('rejects future verification timestamps', () => {
  const bytes = receiptBytes();
  const result = verify(bytes, { now: new Date('2026-08-27T01:00:00.000Z') });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /timestamp cannot be in the future/);
});

test('rejects weak signing keys without exposing the key value', () => {
  const result = verify(receiptBytes(), { signingKey: 'short-secret' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /at least 32 canonical characters/);
  assert.equal(result.errors.join(' ').includes('short-secret'), false);
});

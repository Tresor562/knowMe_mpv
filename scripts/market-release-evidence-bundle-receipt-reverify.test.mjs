import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';
import { finalizeMarketReleaseEvidence } from './market-release-evidence-finalize.mjs';
import { buildMarketReleaseEvidenceBundleReceipt } from './market-release-evidence-bundle-receipt.mjs';
import { reverifyMarketReleaseEvidenceBundleReceipt } from './market-release-evidence-bundle-receipt-reverify.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const signingKeyId = 'release-key-1';
const signingKey = 'k'.repeat(48);
const now = new Date('2026-08-27T03:30:00.000Z');
const manifestPath = '/tmp/release-evidence.signed.json';
const digestPath = '/tmp/release-evidence.signed.sha256';
const artifactSha = 'b'.repeat(64);

function pending(id) {
  return { id, status: 'PENDING', verifiedAt: null, validUntil: null, verifier: null, evidenceRef: null, evidenceSha256: null };
}
function item(id) {
  return { id, status: 'VERIFIED', verifiedAt: '2026-08-27T01:00:00.000Z', validUntil: '2026-09-03T03:00:00.000Z', verifier: 'release-operator', evidenceRef: `evidence://release/${id}.json`, evidenceSha256: artifactSha };
}
function fixture(receiptNow = now) {
  const source = { schemaVersion: 4, scope: 'WEB_V1', environment: 'PRODUCTION', releaseCommit: commit, releaseVersion: version, signingKeyId, evidence: requiredEvidenceForScope('WEB_V1').map(pending), manifestHmacSha256: '0'.repeat(64) };
  const finalized = finalizeMarketReleaseEvidence(source, requiredEvidenceForScope('WEB_V1').map(item), { expectedCommit: commit, expectedVersion: version, expectedSigningKeyId: signingKeyId, signingKey, now: receiptNow });
  assert.equal(finalized.ok, true);
  const digestText = `${finalized.sha256}  ${manifestPath}\n`;
  const receipt = buildMarketReleaseEvidenceBundleReceipt({ manifestBytes: finalized.bytes, digestText, manifestPath, digestPath, expectedCommit: commit, expectedVersion: version, expectedSigningKeyId: signingKeyId, signingKey, now: receiptNow });
  assert.equal(receipt.ok, true);
  return { finalized, digestText, receipt };
}
function verify(overrides = {}) {
  const { finalized, digestText, receipt } = fixture();
  return reverifyMarketReleaseEvidenceBundleReceipt({ receiptBytes: receipt.bytes, manifestBytes: finalized.bytes, digestText, manifestPath, digestPath, expectedCommit: commit, expectedVersion: version, expectedSigningKeyId: signingKeyId, signingKey, now, ...overrides });
}

test('reverifies an authenticated receipt against the exact retained bundle', () => {
  const result = verify();
  assert.equal(result.ok, true);
  assert.match(result.receiptSha256, /^[0-9a-f]{64}$/);
  assert.match(result.manifestSha256, /^[0-9a-f]{64}$/);
});

test('accepts a receipt exactly at the configured freshness boundary', () => {
  const receiptNow = new Date('2026-08-27T02:30:00.000Z');
  const { finalized, digestText, receipt } = fixture(receiptNow);
  const result = reverifyMarketReleaseEvidenceBundleReceipt({ receiptBytes: receipt.bytes, manifestBytes: finalized.bytes, digestText, manifestPath, digestPath, expectedCommit: commit, expectedVersion: version, expectedSigningKeyId: signingKeyId, signingKey, now, maxAgeHours: 1 });
  assert.equal(result.ok, true);
});

test('rejects an authentic receipt older than the configured freshness window', () => {
  const receiptNow = new Date('2026-08-27T02:29:59.999Z');
  const { finalized, digestText, receipt } = fixture(receiptNow);
  const result = reverifyMarketReleaseEvidenceBundleReceipt({ receiptBytes: receipt.bytes, manifestBytes: finalized.bytes, digestText, manifestPath, digestPath, expectedCommit: commit, expectedVersion: version, expectedSigningKeyId: signingKeyId, signingKey, now, maxAgeHours: 1 });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /older than the allowed 1 hour freshness window/);
});

test('rejects non-canonical or out-of-range freshness values', () => {
  for (const maxAgeHours of ['01', '0', '8761', 0, 8761, 1.5]) {
    const result = verify({ maxAgeHours });
    assert.equal(result.ok, false, String(maxAgeHours));
    assert.match(result.errors.join(' '), /Receipt maximum age hours/);
  }
});

test('rejects a different retained manifest path even when the bundle bytes are valid', () => {
  const result = verify({ manifestPath: '/tmp/copied-release-evidence.signed.json' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /manifestPath|does not name/);
});

test('rejects a different retained digest path', () => {
  const result = verify({ digestPath: '/tmp/copied-release-evidence.signed.sha256' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /digestPath/);
});

test('rejects changed digest bytes even if the receipt itself is authentic', () => {
  const { finalized, receipt } = fixture();
  const changedDigest = `${finalized.sha256}  ${manifestPath}\r\n`;
  const result = reverifyMarketReleaseEvidenceBundleReceipt({ receiptBytes: receipt.bytes, manifestBytes: finalized.bytes, digestText: changedDigest, manifestPath, digestPath, expectedCommit: commit, expectedVersion: version, expectedSigningKeyId: signingKeyId, signingKey, now });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /digest|LF line endings/);
});

test('rejects changed manifest bytes', () => {
  const { finalized, digestText, receipt } = fixture();
  const changed = Buffer.from(finalized.bytes);
  changed[changed.length - 2] = changed[changed.length - 2] === 32 ? 33 : 32;
  const result = reverifyMarketReleaseEvidenceBundleReceipt({ receiptBytes: receipt.bytes, manifestBytes: changed, digestText, manifestPath, digestPath, expectedCommit: commit, expectedVersion: version, expectedSigningKeyId: signingKeyId, signingKey, now });
  assert.equal(result.ok, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { requiredEvidenceForScope, validateMarketReleaseEvidence } from './market-release-evidence-preflight.mjs';
import { signMarketReleaseEvidence } from './market-release-evidence-sign.mjs';

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
  return {
    schemaVersion: 4,
    scope: 'WEB_V1',
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion,
    signingKeyId,
    evidence: requiredEvidenceForScope('WEB_V1').map(evidence),
  };
}

function options(overrides = {}) {
  return {
    expectedCommit: commit,
    expectedReleaseVersion: releaseVersion,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
    ...overrides,
  };
}

test('signs a complete manifest and produces a preflight-valid artifact', () => {
  const signed = signMarketReleaseEvidence(manifest(), options());
  assert.match(signed.manifestHmacSha256, /^[0-9a-f]{64}$/);
  assert.equal(validateMarketReleaseEvidence(signed, options()).ok, true);
});

test('refuses to sign pending or incomplete external evidence', () => {
  const pending = manifest();
  pending.evidence[0].status = 'PENDING';
  pending.evidence[0].verifiedAt = null;
  pending.evidence[0].validUntil = null;
  pending.evidence[0].verifier = '';
  pending.evidence[0].evidenceRef = '';
  pending.evidence[0].evidenceSha256 = '';
  assert.throws(() => signMarketReleaseEvidence(pending, options()), /Refusing to sign invalid or incomplete market evidence/);
});

test('refuses commit, version, or key-id mismatches', () => {
  assert.throws(
    () => signMarketReleaseEvidence(manifest(), options({ expectedCommit: 'c'.repeat(40) })),
    /releaseCommit does not match/,
  );
  assert.throws(
    () => signMarketReleaseEvidence(manifest(), options({ expectedReleaseVersion: '1.0.1' })),
    /releaseVersion does not match/,
  );
  assert.throws(
    () => signMarketReleaseEvidence(manifest(), options({ expectedSigningKeyId: 'release-evidence-2026-09' })),
    /signingKeyId does not match/,
  );
});

test('refuses weak signing secrets and leaves the source object unchanged', () => {
  const source = manifest();
  assert.throws(() => signMarketReleaseEvidence(source, options({ signingKey: 'too-short' })), /at least 32/);
  assert.equal(source.manifestHmacSha256, undefined);
});

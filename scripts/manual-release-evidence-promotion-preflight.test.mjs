import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGenericMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';
import { preflightManualReleaseEvidencePromotion } from './manual-release-evidence-promotion-preflight.mjs';

const now = new Date('2026-08-28T19:45:00.000Z');
const artifactBytes = Buffer.from('real-retained-proof\n', 'utf8');
const worksheetBytes = Buffer.from('{"kind":"manual-release-evidence-worksheet"}\n', 'utf8');
const expectedCommit = 'a'.repeat(40);
const expectedVersion = '1.0.0-rc.1';
const id = 'ios_physical_validation';
const evidenceRef = `evidence://release/${id}.json`;

function reviewReceipt() {
  return {
    schemaVersion: 2,
    receiptType: 'MANUAL_RELEASE_EVIDENCE_HUMAN_REVIEW',
    reviewDecision: 'APPROVED_FOR_EVIDENCE_PIPELINE',
    certifiesExternalValidation: false,
    generatedForScope: 'FULL',
    environment: 'PRODUCTION',
    releaseCommit: expectedCommit,
    releaseVersion: expectedVersion,
    evidenceId: id,
    reviewer: 'mobile-qa-lead',
    reviewedAt: '2026-08-28T19:30:00.000Z',
    reviewedWorksheet: { sha256: createHash('sha256').update(worksheetBytes).digest('hex') },
    retainedProof: {
      uri: evidenceRef,
      sha256: createHash('sha256').update(artifactBytes).digest('hex'),
    },
    validationOccurredAt: '2026-08-28T19:20:00.000Z',
    accountableActorOrRole: 'mobile-qa-lead',
    attestationCount: 5,
  };
}

function createItem() {
  const result = createGenericMarketReleaseEvidenceItem(artifactBytes, {
    id,
    scope: 'FULL',
    verifier: 'mobile-qa-lead',
    evidenceRef,
    verifiedAt: '2026-08-28T19:35:00.000Z',
    validUntil: '2026-09-04T19:35:00.000Z',
    worksheetBytes,
    reviewReceipt: reviewReceipt(),
    expectedCommit,
    expectedVersion,
    now,
  });
  assert.equal(result.ok, true);
  return result.item;
}

function preflight(item, overrides = {}) {
  return preflightManualReleaseEvidencePromotion(
    item,
    overrides.artifactBytes ?? artifactBytes,
    overrides.worksheetBytes ?? worksheetBytes,
    overrides.reviewReceipt ?? reviewReceipt(),
    {
      expectedCommit: overrides.expectedCommit ?? expectedCommit,
      expectedVersion: overrides.expectedVersion ?? expectedVersion,
      now,
    },
  );
}

test('accepts the exact item reconstructed from the reviewed chain', () => {
  assert.equal(preflight(createItem()).ok, true);
});

test('rejects item metadata tampering after reviewed promotion', () => {
  const item = createItem();
  for (const changed of [
    { ...item, verifier: 'different-reviewer' },
    { ...item, evidenceRef: 'evidence://release/other.json' },
    { ...item, evidenceSha256: 'b'.repeat(64) },
    { ...item, releaseCommit: 'c'.repeat(40) },
    { ...item, releaseVersion: '1.0.1' },
  ]) {
    assert.equal(preflight(changed).ok, false);
  }
});

test('rejects drift in retained proof, worksheet, receipt decision, and target release', () => {
  const item = createItem();
  assert.equal(preflight(item, { artifactBytes: Buffer.from('different-proof') }).ok, false);
  assert.equal(preflight(item, { worksheetBytes: Buffer.from('{"changed":true}\n') }).ok, false);
  assert.equal(
    preflight(item, { reviewReceipt: { ...reviewReceipt(), reviewDecision: 'REJECTED' } }).ok,
    false,
  );
  assert.equal(preflight(item, { expectedVersion: '1.0.1' }).ok, false);
});

test('rejects non-manual evidence ids', () => {
  const item = { ...createItem(), id: 'backup_restore_drill' };
  const result = preflight(item);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /four FULL physical-device\/store evidence ids/);
});

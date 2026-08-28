import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createGenericMarketReleaseEvidenceItem,
  createMarketReleaseEvidenceItem,
} from './market-release-evidence-item-create.mjs';

const now = new Date('2026-08-26T21:30:00.000Z');
const bytes = Buffer.from('external-proof-bytes\n', 'utf8');
const baseOptions = {
  id: 'backup_restore_drill',
  scope: 'WEB_V1',
  verifier: 'release-operator',
  evidenceRef: 'evidence://release/backup-restore-drill.json',
  verifiedAt: '2026-08-26T21:25:00.000Z',
  validUntil: '2026-09-02T21:25:00.000Z',
  now,
};

function reviewReceipt(id, evidenceRef = `evidence://release/${id}.json`) {
  return {
    schemaVersion: 1,
    receiptType: 'MANUAL_RELEASE_EVIDENCE_HUMAN_REVIEW',
    reviewDecision: 'APPROVED_FOR_EVIDENCE_PIPELINE',
    certifiesExternalValidation: false,
    generatedForScope: 'FULL',
    environment: 'PRODUCTION',
    releaseCommit: '0123456789abcdef0123456789abcdef01234567',
    releaseVersion: '1.2.3',
    evidenceId: id,
    reviewer: 'release-operator',
    reviewedAt: '2026-08-26T21:20:00.000Z',
    retainedProof: {
      uri: evidenceRef,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    validationOccurredAt: '2026-08-26T21:00:00.000Z',
    accountableActorOrRole: 'mobile-qa-lead',
    attestationCount: 5,
  };
}

test('creates a bounded VERIFIED item from the exact artifact bytes for semantic binders', () => {
  const result = createMarketReleaseEvidenceItem(bytes, baseOptions);
  assert.equal(result.ok, true);
  assert.deepEqual(result.item, {
    id: 'backup_restore_drill',
    status: 'VERIFIED',
    verifiedAt: baseOptions.verifiedAt,
    validUntil: baseOptions.validUntil,
    verifier: baseOptions.verifier,
    evidenceRef: baseOptions.evidenceRef,
    evidenceSha256: createHash('sha256').update(bytes).digest('hex'),
  });
});

test('hashes exact bytes instead of normalized text', () => {
  const lf = createMarketReleaseEvidenceItem(Buffer.from('proof\n'), baseOptions);
  const crlf = createMarketReleaseEvidenceItem(Buffer.from('proof\r\n'), baseOptions);
  assert.equal(lf.ok, true);
  assert.equal(crlf.ok, true);
  assert.notEqual(lf.item.evidenceSha256, crlf.item.evidenceSha256);
});

test('enforces scope and rejects FULL-only evidence from WEB_V1 at the low-level constructor', () => {
  const rejected = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    id: 'ios_physical_validation',
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.errors.join(' '), /required by the selected market release scope/);

  const accepted = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    id: 'ios_physical_validation',
    scope: 'FULL',
  });
  assert.equal(accepted.ok, true);
});

test('generic creation refuses common market criteria that have semantic binders', () => {
  for (const id of [
    'production_tls_domain',
    'production_deployment_smoke',
    'backup_restore_drill',
    'external_monitoring_alerting',
    'privacy_terms_legal_review',
    'data_export_delete_validation',
    'moderation_support_incident_ops',
    'antimalware_provider_validation',
  ]) {
    const result = createGenericMarketReleaseEvidenceItem(bytes, {
      ...baseOptions,
      id,
      scope: 'FULL',
    });
    assert.equal(result.ok, false, id);
    assert.match(result.errors.join(' '), /dedicated semantic evidence binder/);
  }
});

test('generic creation requires an exact KMD-307 review receipt for FULL external physical/store evidence', () => {
  for (const id of [
    'ios_physical_validation',
    'android_physical_validation',
    'ios_store_submission',
    'android_store_submission',
  ]) {
    const evidenceRef = `evidence://release/${id}.json`;
    const result = createGenericMarketReleaseEvidenceItem(bytes, {
      ...baseOptions,
      id,
      scope: 'FULL',
      evidenceRef,
      reviewReceipt: reviewReceipt(id, evidenceRef),
    });
    assert.equal(result.ok, true, id);
    assert.equal(result.item.id, id);
  }

  const missingReceipt = createGenericMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    id: 'ios_physical_validation',
    scope: 'FULL',
    evidenceRef: 'evidence://release/ios_physical_validation.json',
  });
  assert.equal(missingReceipt.ok, false);
  assert.match(missingReceipt.errors.join(' '), /reviewReceipt/);

  const webOnly = createGenericMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    id: 'ios_physical_validation',
    scope: 'WEB_V1',
  });
  assert.equal(webOnly.ok, false);
  assert.match(webOnly.errors.join(' '), /requires scope FULL/);
});

test('generic promotion rejects receipt/artifact, evidence id, URI, reviewer, and decision drift', () => {
  const id = 'android_physical_validation';
  const evidenceRef = `evidence://release/${id}.json`;
  const options = {
    ...baseOptions,
    id,
    scope: 'FULL',
    evidenceRef,
    reviewReceipt: reviewReceipt(id, evidenceRef),
  };

  const wrongBytes = createGenericMarketReleaseEvidenceItem(Buffer.from('different-proof'), options);
  assert.equal(wrongBytes.ok, false);
  assert.match(wrongBytes.errors.join(' '), /SHA-256/);

  const wrongIdReceipt = { ...reviewReceipt(id, evidenceRef), evidenceId: 'ios_physical_validation' };
  const wrongId = createGenericMarketReleaseEvidenceItem(bytes, { ...options, reviewReceipt: wrongIdReceipt });
  assert.equal(wrongId.ok, false);
  assert.match(wrongId.errors.join(' '), /evidenceId/);

  const wrongUriReceipt = {
    ...reviewReceipt(id, evidenceRef),
    retainedProof: { ...reviewReceipt(id, evidenceRef).retainedProof, uri: 'evidence://release/other.json' },
  };
  const wrongUri = createGenericMarketReleaseEvidenceItem(bytes, { ...options, reviewReceipt: wrongUriReceipt });
  assert.equal(wrongUri.ok, false);
  assert.match(wrongUri.errors.join(' '), /evidenceRef/);

  const wrongReviewer = createGenericMarketReleaseEvidenceItem(bytes, {
    ...options,
    verifier: 'different-reviewer',
  });
  assert.equal(wrongReviewer.ok, false);
  assert.match(wrongReviewer.errors.join(' '), /human reviewer/);

  const wrongDecisionReceipt = {
    ...reviewReceipt(id, evidenceRef),
    reviewDecision: 'REJECTED',
  };
  const wrongDecision = createGenericMarketReleaseEvidenceItem(bytes, {
    ...options,
    reviewReceipt: wrongDecisionReceipt,
  });
  assert.equal(wrongDecision.ok, false);
  assert.match(wrongDecision.errors.join(' '), /reviewDecision/);
});

test('rejects unsafe or non-canonical verifier and evidence references', () => {
  const badVerifier = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    verifier: ' release-operator ',
  });
  assert.equal(badVerifier.ok, false);

  for (const evidenceRef of [
    'http://evidence.example/proof.json',
    'https://user:secret@evidence.example/proof.json',
    'https://evidence.example/proof.json?token=secret',
    'https://evidence.example/proof.json#fragment',
  ]) {
    const result = createMarketReleaseEvidenceItem(bytes, { ...baseOptions, evidenceRef });
    assert.equal(result.ok, false, evidenceRef);
  }
});

test('rejects future, expired, and non-canonical timestamps', () => {
  const future = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    verifiedAt: '2026-08-26T21:40:01.000Z',
  });
  assert.equal(future.ok, false);

  const expired = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    validUntil: '2026-08-26T21:29:59.000Z',
  });
  assert.equal(expired.ok, false);

  const nonCanonical = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    verifiedAt: '2026-08-26T21:25:00Z',
  });
  assert.equal(nonCanonical.ok, false);
});

test('rejects unknown evidence ids and invalid artifact inputs', () => {
  const unknown = createMarketReleaseEvidenceItem(bytes, { ...baseOptions, id: 'made_up_proof' });
  assert.equal(unknown.ok, false);

  const invalidBytes = createMarketReleaseEvidenceItem('not-bytes', baseOptions);
  assert.equal(invalidBytes.ok, false);
  assert.match(invalidBytes.errors.join(' '), /artifactBytes/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  applyMarketReleaseEvidenceItem,
  applyProductionDeploymentSmokeEvidenceItem,
} from './market-release-evidence-item-apply.mjs';
import { createGenericMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';
import { preflightManualReleaseEvidencePromotion } from './manual-release-evidence-promotion-preflight.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const now = new Date('2026-08-26T20:00:00.000Z');
const manualIds = new Set(['ios_physical_validation', 'android_physical_validation', 'ios_store_submission', 'android_store_submission']);
const pending = (id) => ({ id, status: 'PENDING', verifiedAt: null, validUntil: null, verifier: '', evidenceRef: '', evidenceSha256: '' });
const artifactBytes = Buffer.from('retained-manual-proof\n');
const worksheetBytes = Buffer.from('{"kind":"manual-release-evidence-worksheet"}\n');

function manifest(scope = 'WEB_V1') {
  const common = [
    'production_tls_domain', 'production_deployment_smoke', 'backup_restore_drill', 'external_monitoring_alerting',
    'privacy_terms_legal_review', 'data_export_delete_validation', 'moderation_support_incident_ops', 'antimalware_provider_validation',
  ];
  const full = ['ios_physical_validation', 'android_physical_validation', 'ios_store_submission', 'android_store_submission'];
  return {
    schemaVersion: 4,
    scope,
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion: version,
    signingKeyId: 'release-key-1',
    evidence: [...common, ...(scope === 'FULL' ? full : [])].map(pending),
    manifestHmacSha256: '0'.repeat(64),
  };
}

function item(id = 'production_deployment_smoke') {
  const base = {
    id,
    status: 'VERIFIED',
    verifiedAt: '2026-08-26T19:55:00.000Z',
    validUntil: '2026-09-02T19:55:00.000Z',
    verifier: 'release-operator',
    evidenceRef: `evidence://release/${id}.json`,
    evidenceSha256: 'b'.repeat(64),
  };
  return manualIds.has(id) ? { ...base, releaseCommit: commit, releaseVersion: version } : base;
}

function reviewedManual(id = 'ios_physical_validation') {
  const evidenceRef = `evidence://release/${id}.json`;
  const reviewReceipt = {
    schemaVersion: 2,
    receiptType: 'MANUAL_RELEASE_EVIDENCE_HUMAN_REVIEW',
    reviewDecision: 'APPROVED_FOR_EVIDENCE_PIPELINE',
    certifiesExternalValidation: false,
    generatedForScope: 'FULL',
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion: version,
    evidenceId: id,
    reviewer: 'mobile-qa-lead',
    reviewedAt: '2026-08-26T19:40:00.000Z',
    reviewedWorksheet: { sha256: createHash('sha256').update(worksheetBytes).digest('hex') },
    retainedProof: { uri: evidenceRef, sha256: createHash('sha256').update(artifactBytes).digest('hex') },
    validationOccurredAt: '2026-08-26T19:35:00.000Z',
    accountableActorOrRole: 'mobile-qa-lead',
    attestationCount: 5,
  };
  const created = createGenericMarketReleaseEvidenceItem(artifactBytes, {
    id,
    scope: 'FULL',
    verifier: 'mobile-qa-lead',
    evidenceRef,
    verifiedAt: '2026-08-26T19:45:00.000Z',
    validUntil: '2026-09-02T19:45:00.000Z',
    worksheetBytes,
    reviewReceipt,
    expectedCommit: commit,
    expectedVersion: version,
    now,
  });
  assert.equal(created.ok, true);
  const preflight = preflightManualReleaseEvidencePromotion(
    created.item,
    artifactBytes,
    worksheetBytes,
    reviewReceipt,
    { expectedCommit: commit, expectedVersion: version, now },
  );
  assert.equal(preflight.ok, true);
  return { item: created.item, authorization: preflight.authorization };
}

function apply(source, evidenceItem, manualAuthorization) {
  return applyMarketReleaseEvidenceItem(source, evidenceItem, {
    expectedCommit: commit,
    expectedVersion: version,
    now,
    manualAuthorization,
  });
}

test('applies a common WEB_V1 evidence item and keeps manifest unsigned', () => {
  const source = manifest();
  const evidenceItem = item('backup_restore_drill');
  const result = apply(source, evidenceItem);
  assert.equal(result.ok, true);
  assert.deepEqual(result.manifest.evidence.find((entry) => entry.id === evidenceItem.id), evidenceItem);
  assert.equal(result.manifest.manifestHmacSha256, '0'.repeat(64));
  assert.equal(source.evidence.find((entry) => entry.id === evidenceItem.id).status, 'PENDING');
});

test('applies FULL manual evidence only with an authorization minted from the exact reviewed chain', () => {
  const reviewed = reviewedManual('ios_physical_validation');
  assert.equal(apply(manifest('WEB_V1'), reviewed.item, reviewed.authorization).ok, false);
  assert.equal(apply(manifest('FULL'), reviewed.item).ok, false);
  const forged = { ...reviewed.authorization };
  assert.equal(apply(manifest('FULL'), reviewed.item, forged).ok, false);
  const result = apply(manifest('FULL'), reviewed.item, reviewed.authorization);
  assert.equal(result.ok, true);
  const applied = result.manifest.evidence.find((entry) => entry.id === reviewed.item.id);
  assert.equal(applied.status, 'VERIFIED');
  assert.equal('releaseCommit' in applied, false);
  assert.equal('releaseVersion' in applied, false);
});

test('rejects authorization reuse after manual item drift', () => {
  const reviewed = reviewedManual('android_physical_validation');
  const changed = { ...reviewed.item, verifier: 'different-reviewer' };
  const result = apply(manifest('FULL'), changed, reviewed.authorization);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /authorization/);
});

test('rejects replay of serialized manual evidence into a different release', () => {
  const physical = item('android_physical_validation');
  const wrongCommit = applyMarketReleaseEvidenceItem(manifest('FULL'), physical, {
    expectedCommit: 'd'.repeat(40), expectedVersion: version, now,
  });
  assert.equal(wrongCommit.ok, false);
  assert.match(wrongCommit.errors.join(' '), /releaseCommit/);

  const sourceWithNewVersion = manifest('FULL');
  sourceWithNewVersion.releaseVersion = '1.0.1';
  const wrongVersion = applyMarketReleaseEvidenceItem(sourceWithNewVersion, physical, {
    expectedCommit: commit, expectedVersion: '1.0.1', now,
  });
  assert.equal(wrongVersion.ok, false);
  assert.match(wrongVersion.errors.join(' '), /manual evidence item releaseVersion/);

  const unbound = { ...physical };
  delete unbound.releaseCommit;
  delete unbound.releaseVersion;
  const missingBinding = apply(manifest('FULL'), unbound);
  assert.equal(missingBinding.ok, false);
  assert.match(missingBinding.errors.join(' '), /releaseCommit and releaseVersion/);
});

test('rejects non-canonical verifier and evidence references before manifest mutation', () => {
  const leadingSpaceVerifier = { ...item('backup_restore_drill'), verifier: ' release-operator' };
  const verifierResult = apply(manifest(), leadingSpaceVerifier);
  assert.equal(verifierResult.ok, false);
  assert.match(verifierResult.errors.join(' '), /verifier must be canonical/);
  assert.equal(apply(manifest(), { ...item('backup_restore_drill'), verifier: 'release\noperator' }).ok, false);
  assert.equal(apply(manifest(), { ...item('backup_restore_drill'), evidenceRef: 'https://user:secret@example.com/evidence.json' }).ok, false);
  assert.equal(apply(manifest(), { ...item('backup_restore_drill'), evidenceRef: 'https://example.com/evidence.json?token=secret' }).ok, false);
  assert.equal(apply(manifest(), { ...item('backup_restore_drill'), evidenceRef: 'evidence://release/backup.json#fragment' }).ok, false);
  assert.equal(apply(manifest(), { ...item('backup_restore_drill'), evidenceRef: 'file:///tmp/evidence.json' }).ok, false);
});

test('preserves the KMD-267 production smoke compatibility wrapper', () => {
  const source = manifest();
  const smoke = item();
  const result = applyProductionDeploymentSmokeEvidenceItem(source, smoke, { expectedCommit: commit, expectedVersion: version, now });
  assert.equal(result.ok, true);
  const wrong = applyProductionDeploymentSmokeEvidenceItem(source, item('backup_restore_drill'), { expectedCommit: commit, expectedVersion: version, now });
  assert.equal(wrong.ok, false);
  assert.match(wrong.errors.join(' '), /production_deployment_smoke/);
});

test('rejects a previously signed manifest', () => {
  const source = manifest();
  source.manifestHmacSha256 = 'c'.repeat(64);
  const result = apply(source, item('production_tls_domain'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /unsigned/);
});

test('rejects commit and version mismatches', () => {
  const wrongCommit = applyMarketReleaseEvidenceItem(manifest(), item(), { expectedCommit: 'd'.repeat(40), expectedVersion: version, now });
  assert.equal(wrongCommit.ok, false);
  assert.match(wrongCommit.errors.join(' '), /releaseCommit/);
  const wrongVersion = applyMarketReleaseEvidenceItem(manifest(), item(), { expectedCommit: commit, expectedVersion: '1.0.1', now });
  assert.equal(wrongVersion.ok, false);
  assert.match(wrongVersion.errors.join(' '), /releaseVersion/);
});

test('rejects unknown IDs, extra fields, stale validity, duplicate slots, or non-pending slots', () => {
  assert.equal(apply(manifest(), item('not_a_release_evidence_id')).ok, false);
  assert.equal(apply(manifest(), { ...item('backup_restore_drill'), unexpected: true }).ok, false);
  assert.equal(apply(manifest(), { ...item('backup_restore_drill'), validUntil: '2026-08-26T19:59:59.000Z' }).ok, false);
  const duplicate = manifest();
  duplicate.evidence.push(pending('backup_restore_drill'));
  assert.equal(apply(duplicate, item('backup_restore_drill')).ok, false);
  const alreadyApplied = manifest();
  const index = alreadyApplied.evidence.findIndex((entry) => entry.id === 'backup_restore_drill');
  alreadyApplied.evidence[index] = item('backup_restore_drill');
  const result = apply(alreadyApplied, item('backup_restore_drill'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /PENDING/);
});

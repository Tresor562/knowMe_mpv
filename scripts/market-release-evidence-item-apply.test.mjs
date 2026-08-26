import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProductionDeploymentSmokeEvidenceItem } from './market-release-evidence-item-apply.mjs';

const commit = 'a'.repeat(40);
const now = new Date('2026-08-26T20:00:00.000Z');
const pending = (id) => ({ id, status: 'PENDING', verifiedAt: null, validUntil: null, verifier: '', evidenceRef: '', evidenceSha256: '' });

function manifest() {
  return {
    schemaVersion: 4,
    scope: 'WEB_V1',
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion: '1.0.0-rc.1',
    signingKeyId: 'release-key-1',
    evidence: [pending('production_tls_domain'), pending('production_deployment_smoke'), pending('backup_restore_drill')],
    manifestHmacSha256: '0'.repeat(64),
  };
}

function item() {
  return {
    id: 'production_deployment_smoke',
    status: 'VERIFIED',
    verifiedAt: '2026-08-26T19:55:00.000Z',
    validUntil: '2026-09-02T19:55:00.000Z',
    verifier: 'release-operator',
    evidenceRef: 'evidence://release/production-smoke.json',
    evidenceSha256: 'b'.repeat(64),
  };
}

test('applies only the production deployment smoke slot and keeps manifest unsigned', () => {
  const source = manifest();
  const result = applyProductionDeploymentSmokeEvidenceItem(source, item(), {
    expectedCommit: commit,
    expectedVersion: '1.0.0-rc.1',
    now,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.manifest.evidence[0], source.evidence[0]);
  assert.deepEqual(result.manifest.evidence[1], item());
  assert.equal(result.manifest.manifestHmacSha256, '0'.repeat(64));
  assert.equal(source.evidence[1].status, 'PENDING');
});

test('rejects a previously signed manifest', () => {
  const source = manifest();
  source.manifestHmacSha256 = 'c'.repeat(64);
  const result = applyProductionDeploymentSmokeEvidenceItem(source, item(), {
    expectedCommit: commit,
    expectedVersion: '1.0.0-rc.1',
    now,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /unsigned/);
});

test('rejects commit and version mismatches', () => {
  const wrongCommit = applyProductionDeploymentSmokeEvidenceItem(manifest(), item(), {
    expectedCommit: 'd'.repeat(40),
    expectedVersion: '1.0.0-rc.1',
    now,
  });
  assert.equal(wrongCommit.ok, false);
  assert.match(wrongCommit.errors.join(' '), /releaseCommit/);

  const wrongVersion = applyProductionDeploymentSmokeEvidenceItem(manifest(), item(), {
    expectedCommit: commit,
    expectedVersion: '1.0.1',
    now,
  });
  assert.equal(wrongVersion.ok, false);
  assert.match(wrongVersion.errors.join(' '), /releaseVersion/);
});

test('rejects the wrong item id, extra fields, stale validity, or non-pending slot', () => {
  const wrongId = { ...item(), id: 'backup_restore_drill' };
  assert.equal(applyProductionDeploymentSmokeEvidenceItem(manifest(), wrongId, { expectedCommit: commit, expectedVersion: '1.0.0-rc.1', now }).ok, false);

  const extra = { ...item(), unexpected: true };
  assert.equal(applyProductionDeploymentSmokeEvidenceItem(manifest(), extra, { expectedCommit: commit, expectedVersion: '1.0.0-rc.1', now }).ok, false);

  const stale = { ...item(), validUntil: '2026-08-26T19:59:59.000Z' };
  assert.equal(applyProductionDeploymentSmokeEvidenceItem(manifest(), stale, { expectedCommit: commit, expectedVersion: '1.0.0-rc.1', now }).ok, false);

  const alreadyApplied = manifest();
  alreadyApplied.evidence[1] = item();
  const result = applyProductionDeploymentSmokeEvidenceItem(alreadyApplied, item(), { expectedCommit: commit, expectedVersion: '1.0.0-rc.1', now });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /PENDING/);
});

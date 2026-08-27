import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDataExportDeleteMarketEvidenceItem,
  validateDataExportDeleteSmokeArtifact,
} from './data-export-delete-smoke-evidence-binding.mjs';

const NOW = new Date('2026-08-27T19:10:00.000Z');

function artifact(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'knowme-data-export-delete-smoke',
    status: 'PASSED',
    observedAt: '2026-08-27T19:00:00.000Z',
    productionOrigin: 'https://api.knowme.example',
    canaryUserIdSha256: 'a'.repeat(64),
    checks: {
      ephemeralRegistration: 'PASSED',
      accountExport: 'PASSED',
      exportFormatVersion: 20,
      passwordHashExcluded: true,
      accountDeletion: 'PASSED',
      deletedAccountAuthenticationRejected: true,
    },
    proofBoundary:
      'This artifact proves only this ephemeral canary export/delete flow at the observed production origin; it does not prove legal compliance or deletion from provider backups outside KnowMe.',
    ...overrides,
  };
}

function bytes(value = artifact()) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('accepts the exact KMD-291 schema and derives verifiedAt from observedAt', () => {
  const result = createDataExportDeleteMarketEvidenceItem(bytes(), {
    scope: 'WEB_V1',
    verifier: 'release-operator',
    evidenceRef: 'evidence://knowme/data-export-delete/2026-08-27',
    validUntil: '2026-09-27T19:00:00.000Z',
    now: NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.item.id, 'data_export_delete_validation');
  assert.equal(result.item.status, 'VERIFIED');
  assert.equal(result.item.verifiedAt, '2026-08-27T19:00:00.000Z');
  assert.match(result.item.evidenceSha256, /^[0-9a-f]{64}$/);
});

test('rejects unknown top-level and check fields even when otherwise plausible', () => {
  assert.equal(validateDataExportDeleteSmokeArtifact({ ...artifact(), extra: true }, { now: NOW }).ok, false);
  const changed = artifact({ checks: { ...artifact().checks, extra: true } });
  assert.equal(validateDataExportDeleteSmokeArtifact(changed, { now: NOW }).ok, false);
});

test('rejects a failed or incomplete export/delete lifecycle', () => {
  for (const [key, value] of [
    ['ephemeralRegistration', 'FAILED'],
    ['accountExport', 'FAILED'],
    ['passwordHashExcluded', false],
    ['accountDeletion', 'FAILED'],
    ['deletedAccountAuthenticationRejected', false],
  ]) {
    const changed = artifact({ checks: { ...artifact().checks, [key]: value } });
    assert.equal(validateDataExportDeleteSmokeArtifact(changed, { now: NOW }).ok, false, key);
  }
});

test('rejects invalid export format, canary hash, origin, proof boundary and future observation', () => {
  assert.equal(validateDataExportDeleteSmokeArtifact(artifact({ checks: { ...artifact().checks, exportFormatVersion: 0 } }), { now: NOW }).ok, false);
  assert.equal(validateDataExportDeleteSmokeArtifact(artifact({ canaryUserIdSha256: 'A'.repeat(64) }), { now: NOW }).ok, false);
  assert.equal(validateDataExportDeleteSmokeArtifact(artifact({ productionOrigin: 'http://api.knowme.example' }), { now: NOW }).ok, false);
  assert.equal(validateDataExportDeleteSmokeArtifact(artifact({ proofBoundary: 'broader claim' }), { now: NOW }).ok, false);
  assert.equal(validateDataExportDeleteSmokeArtifact(artifact({ observedAt: '2026-08-27T19:20:01.000Z' }), { now: NOW }).ok, false);
});

test('rejects invalid JSON and market evidence metadata that is outside the canonical contract', () => {
  assert.equal(createDataExportDeleteMarketEvidenceItem(Buffer.from('{bad json'), { now: NOW }).ok, false);
  const result = createDataExportDeleteMarketEvidenceItem(bytes(), {
    scope: 'WEB_V1',
    verifier: ' release-operator ',
    evidenceRef: 'http://unsafe.example/evidence',
    validUntil: '2026-09-27T19:00:00.000Z',
    now: NOW,
  });
  assert.equal(result.ok, false);
});

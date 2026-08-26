import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProductionDeploymentSmokeEvidenceItem, sha256Buffer } from './production-smoke-evidence-binding.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const observedAt = '2026-08-26T18:00:00.000Z';
const validUntil = '2026-08-27T18:00:00.000Z';
const artifact = {
  schemaVersion: 1,
  type: 'knowme-production-smoke-evidence',
  observedAt,
  productionOrigin: 'https://api.example.com/',
  release: { commit, version },
  checks: {
    deploymentReadiness: { passed: true, endpoint: 'https://api.example.com/health/ready' },
    metricsSurface: { passed: true, endpoint: 'https://api.example.com/health/metrics' },
  },
};
const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

function build(overrides = {}) {
  return buildProductionDeploymentSmokeEvidenceItem({
    artifactBytes: bytes,
    expectedCommit: commit,
    expectedVersion: version,
    verifier: 'release-operator',
    evidenceRef: 'evidence://release/production-smoke.json',
    validUntil,
    now: new Date('2026-08-26T19:00:00.000Z'),
    ...overrides,
  });
}

test('builds a VERIFIED production deployment smoke evidence item bound to exact bytes', () => {
  const result = build();
  assert.equal(result.ok, true);
  assert.deepEqual(result.item, {
    id: 'production_deployment_smoke',
    status: 'VERIFIED',
    verifiedAt: observedAt,
    validUntil,
    verifier: 'release-operator',
    evidenceRef: 'evidence://release/production-smoke.json',
    evidenceSha256: sha256Buffer(bytes),
  });
});

test('rejects release identity mismatches', () => {
  assert.equal(build({ expectedCommit: 'b'.repeat(40) }).ok, false);
  assert.equal(build({ expectedVersion: '1.0.1' }).ok, false);
});

test('validates the same exact bytes that are hashed', () => {
  const failedArtifact = {
    ...artifact,
    checks: { ...artifact.checks, metricsSurface: { passed: false } },
  };
  const failedBytes = Buffer.from(`${JSON.stringify(failedArtifact, null, 2)}\n`, 'utf8');
  assert.equal(build({ artifactBytes: failedBytes }).ok, false);
  assert.equal(build({ artifactBytes: Buffer.from('{invalid-json', 'utf8') }).ok, false);
});

test('rejects unsafe evidence references and stale validity', () => {
  assert.equal(build({ evidenceRef: 'https://user:secret@example.com/proof' }).ok, false);
  assert.equal(build({ evidenceRef: 'https://example.com/proof?token=secret' }).ok, false);
  assert.equal(build({ validUntil: '2026-08-26T18:30:00.000Z' }).ok, false);
});

test('rejects future smoke observations', () => {
  assert.equal(build({ now: new Date('2026-08-26T17:00:00.000Z') }).ok, false);
});

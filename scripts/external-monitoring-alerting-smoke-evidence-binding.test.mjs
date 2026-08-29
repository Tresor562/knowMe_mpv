import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  createExternalMonitoringAlertingMarketEvidenceItem,
  validateExternalMonitoringAlertingSmokeArtifact,
} from './external-monitoring-alerting-smoke-evidence-binding.mjs';

const NOW = new Date('2026-08-27T18:00:00.000Z');
const VALID_UNTIL = '2026-09-03T17:55:00.000Z';
const cliPath = fileURLToPath(new URL('./external-monitoring-alerting-smoke-evidence-binding.mjs', import.meta.url));

function artifact(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'knowme-external-monitoring-alerting-smoke',
    status: 'PASSED',
    observedAt: '2026-08-27T17:55:00.000Z',
    productionOrigin: 'https://knowme.example/',
    evidenceEndpointSha256: 'a'.repeat(64),
    providerName: 'Example Monitor',
    monitorIdHash: 'b'.repeat(64),
    monitoring: { state: 'UP', lastCheckedAt: '2026-08-27T17:50:00.000Z' },
    alerting: { enabled: true, lastTestAt: '2026-08-27T12:00:00.000Z', lastTestStatus: 'DELIVERED' },
    policy: { maxObservationAgeSeconds: 900, maxAlertTestAgeHours: 24 },
    ...overrides,
  };
}

function bytes() {
  return Buffer.from(`${JSON.stringify(artifact(), null, 2)}\n`, 'utf8');
}

function cliArgs(artifactPath, outputPath) {
  return [
    cliPath,
    '--artifact', artifactPath,
    '--output', outputPath,
    '--scope', 'WEB_V1',
    '--verifier', 'release-operator',
    '--ref', 'evidence://monitoring/2026-08-27',
    '--valid-until', VALID_UNTIL,
  ];
}

test('accepts an exact passed external monitoring artifact', () => {
  assert.deepEqual(validateExternalMonitoringAlertingSmokeArtifact(artifact(), { now: NOW }), {
    ok: true,
    verifiedAt: '2026-08-27T17:55:00.000Z',
  });
});

test('creates external_monitoring_alerting item from exact retained bytes', () => {
  const retainedBytes = Buffer.from(JSON.stringify(artifact()));
  const result = createExternalMonitoringAlertingMarketEvidenceItem(retainedBytes, {
    scope: 'WEB_V1',
    verifier: 'release-operator',
    evidenceRef: 'evidence://monitoring/2026-08-27',
    validUntil: VALID_UNTIL,
    now: NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.item.id, 'external_monitoring_alerting');
  assert.equal(result.item.status, 'VERIFIED');
  assert.equal(result.item.verifiedAt, '2026-08-27T17:55:00.000Z');
  assert.match(result.item.evidenceSha256, /^[0-9a-f]{64}$/);
});

test('rejects unknown fields and failed monitoring state', () => {
  assert.equal(validateExternalMonitoringAlertingSmokeArtifact(artifact({ debug: true }), { now: NOW }).ok, false);
  assert.equal(
    validateExternalMonitoringAlertingSmokeArtifact(artifact({ monitoring: { state: 'DOWN', lastCheckedAt: '2026-08-27T17:50:00.000Z' } }), { now: NOW }).ok,
    false,
  );
});

test('rejects disabled or undelivered alerting', () => {
  assert.equal(
    validateExternalMonitoringAlertingSmokeArtifact(artifact({ alerting: { enabled: false, lastTestAt: '2026-08-27T12:00:00.000Z', lastTestStatus: 'DELIVERED' } }), { now: NOW }).ok,
    false,
  );
  assert.equal(
    validateExternalMonitoringAlertingSmokeArtifact(artifact({ alerting: { enabled: true, lastTestAt: '2026-08-27T12:00:00.000Z', lastTestStatus: 'FAILED' } }), { now: NOW }).ok,
    false,
  );
});

test('recomputes freshness from retained timestamps and policy', () => {
  assert.equal(
    validateExternalMonitoringAlertingSmokeArtifact(artifact({ monitoring: { state: 'UP', lastCheckedAt: '2026-08-27T17:30:00.000Z' } }), { now: NOW }).ok,
    false,
  );
  assert.equal(
    validateExternalMonitoringAlertingSmokeArtifact(artifact({ alerting: { enabled: true, lastTestAt: '2026-08-25T12:00:00.000Z', lastTestStatus: 'DELIVERED' } }), { now: NOW }).ok,
    false,
  );
});

test('rejects malformed hashes, origin, provider, future observation, and JSON', () => {
  assert.equal(validateExternalMonitoringAlertingSmokeArtifact(artifact({ evidenceEndpointSha256: 'A'.repeat(64) }), { now: NOW }).ok, false);
  assert.equal(validateExternalMonitoringAlertingSmokeArtifact(artifact({ productionOrigin: 'http://knowme.example/' }), { now: NOW }).ok, false);
  assert.equal(validateExternalMonitoringAlertingSmokeArtifact(artifact({ providerName: ' Example Monitor ' }), { now: NOW }).ok, false);
  assert.equal(validateExternalMonitoringAlertingSmokeArtifact(artifact({ observedAt: '2026-08-28T18:00:00.000Z' }), { now: NOW }).ok, false);
  assert.equal(createExternalMonitoringAlertingMarketEvidenceItem(Buffer.from('{'), { now: NOW }).ok, false);
});

test('CLI creates external monitoring evidence from a regular retained artifact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-monitoring-binding-'));
  try {
    const artifactPath = join(dir, 'monitoring.json');
    const outputPath = join(dir, 'item.json');
    await writeFile(artifactPath, bytes());

    const result = spawnSync(process.execPath, cliArgs(artifactPath, outputPath), { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const item = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(item.id, 'external_monitoring_alerting');
    assert.equal(item.status, 'VERIFIED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CLI rejects a symlinked external monitoring artifact before JSON ingestion', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Symlink creation is not reliably available on Windows CI without elevated privileges.');
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), 'knowme-monitoring-binding-symlink-'));
  try {
    const targetPath = join(dir, 'monitoring-target.json');
    const artifactPath = join(dir, 'monitoring-link.json');
    const outputPath = join(dir, 'item.json');
    await writeFile(targetPath, bytes());
    await symlink(targetPath, artifactPath);

    const result = spawnSync(process.execPath, cliArgs(artifactPath, outputPath), { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /regular non-symlink file/);
    assert.equal(existsSync(outputPath), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

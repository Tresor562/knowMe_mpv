import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createExternalMonitoringAlertingMarketEvidenceItem,
  validateExternalMonitoringAlertingSmokeArtifact,
} from './external-monitoring-alerting-smoke-evidence-binding.mjs';

const NOW = new Date('2026-08-27T18:00:00.000Z');

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

test('accepts an exact passed external monitoring artifact', () => {
  assert.deepEqual(validateExternalMonitoringAlertingSmokeArtifact(artifact(), { now: NOW }), {
    ok: true,
    verifiedAt: '2026-08-27T17:55:00.000Z',
  });
});

test('creates external_monitoring_alerting item from exact retained bytes', () => {
  const bytes = Buffer.from(JSON.stringify(artifact()));
  const result = createExternalMonitoringAlertingMarketEvidenceItem(bytes, {
    scope: 'WEB_V1',
    verifier: 'release-operator',
    evidenceRef: 'evidence://monitoring/2026-08-27',
    validUntil: '2026-09-03T17:55:00.000Z',
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

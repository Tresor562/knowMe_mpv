import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  canonicalMonitoringEvidenceUrl,
  validateMonitoringAttestation,
  verifyExternalMonitoringAlerting,
  writeExternalMonitoringEvidence,
} from './external-monitoring-alerting-smoke.mjs';

const NOW = new Date('2026-08-27T16:00:00.000Z');
const ORIGIN = 'https://knowme.example/';
const URL = 'https://monitoring.example/api/knowme/evidence';
const TOKEN = 'm'.repeat(40);
const MONITOR_HASH = 'a'.repeat(64);

function attestation(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'knowme-external-monitoring-alerting-attestation',
    productionOrigin: ORIGIN,
    status: 'PASSING',
    monitoring: { state: 'UP', lastCheckedAt: '2026-08-27T15:55:00.000Z' },
    alerting: { enabled: true, lastTestAt: '2026-08-27T08:00:00.000Z', lastTestStatus: 'DELIVERED' },
    provider: { name: 'Example Monitor', monitorIdHash: MONITOR_HASH },
    ...overrides,
  };
}

function response(payload, { status = 200, contentType = 'application/json' } = {}) {
  const text = JSON.stringify(payload);
  return {
    status,
    headers: { get(name) { return name.toLowerCase() === 'content-type' ? contentType : name.toLowerCase() === 'content-length' ? String(Buffer.byteLength(text)) : null; } },
    async text() { return text; },
  };
}

test('accepts a fresh UP monitor with delivered alert test', async () => {
  const artifact = await verifyExternalMonitoringAlerting({
    evidenceUrl: URL,
    evidenceToken: TOKEN,
    productionOrigin: ORIGIN,
    now: NOW,
    fetchImpl: async (url, options) => {
      assert.equal(url, URL);
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.authorization, `Bearer ${TOKEN}`);
      return response(attestation());
    },
  });
  assert.equal(artifact.status, 'PASSED');
  assert.equal(artifact.productionOrigin, ORIGIN);
  assert.equal(artifact.providerName, 'Example Monitor');
  assert.equal(artifact.monitorIdHash, MONITOR_HASH);
  assert.equal(artifact.alerting.lastTestStatus, 'DELIVERED');
  assert.equal(JSON.stringify(artifact).includes(TOKEN), false);
  assert.equal(JSON.stringify(artifact).includes(URL), false);
});

test('rejects unsafe monitoring evidence URLs', () => {
  assert.equal(canonicalMonitoringEvidenceUrl('http://monitoring.example/evidence'), null);
  assert.equal(canonicalMonitoringEvidenceUrl('https://user:pass@monitoring.example/evidence'), null);
  assert.equal(canonicalMonitoringEvidenceUrl('https://monitoring.example/evidence?token=x'), null);
  assert.equal(canonicalMonitoringEvidenceUrl('https://monitoring.example/evidence#x'), null);
  assert.equal(canonicalMonitoringEvidenceUrl(URL), URL);
});

test('fails closed when monitor state is DOWN or alerting is disabled', () => {
  const down = validateMonitoringAttestation(attestation({ monitoring: { state: 'DOWN', lastCheckedAt: '2026-08-27T15:55:00.000Z' } }), { productionOrigin: ORIGIN, now: NOW });
  assert.equal(down.ok, false);
  assert.match(down.errors.join(' '), /must equal UP/);
  const disabled = validateMonitoringAttestation(attestation({ alerting: { enabled: false, lastTestAt: '2026-08-27T08:00:00.000Z', lastTestStatus: 'DELIVERED' } }), { productionOrigin: ORIGIN, now: NOW });
  assert.equal(disabled.ok, false);
  assert.match(disabled.errors.join(' '), /must be enabled/);
});

test('rejects stale observation and stale alert delivery test', () => {
  const staleMonitor = validateMonitoringAttestation(attestation({ monitoring: { state: 'UP', lastCheckedAt: '2026-08-27T15:30:00.000Z' } }), { productionOrigin: ORIGIN, now: NOW, maxObservationAgeSeconds: 900 });
  assert.equal(staleMonitor.ok, false);
  assert.match(staleMonitor.errors.join(' '), /observation is too old/);
  const staleAlert = validateMonitoringAttestation(attestation({ alerting: { enabled: true, lastTestAt: '2026-08-25T08:00:00.000Z', lastTestStatus: 'DELIVERED' } }), { productionOrigin: ORIGIN, now: NOW, maxAlertTestAgeHours: 24 });
  assert.equal(staleAlert.ok, false);
  assert.match(staleAlert.errors.join(' '), /alert test is too old/);
});

test('rejects wrong production target, unknown fields and malformed provider hash', () => {
  const wrongOrigin = validateMonitoringAttestation(attestation(), { productionOrigin: 'https://other.example/', now: NOW });
  assert.equal(wrongOrigin.ok, false);
  assert.match(wrongOrigin.errors.join(' '), /does not match/);
  const unknown = validateMonitoringAttestation({ ...attestation(), extra: true }, { productionOrigin: ORIGIN, now: NOW });
  assert.equal(unknown.ok, false);
  assert.match(unknown.errors.join(' '), /exact schema-v1/);
  const badHash = validateMonitoringAttestation(attestation({ provider: { name: 'Example Monitor', monitorIdHash: 'BAD' } }), { productionOrigin: ORIGIN, now: NOW });
  assert.equal(badHash.ok, false);
  assert.match(badHash.errors.join(' '), /monitorIdHash/);
});

test('rejects weak token and non-JSON provider responses', async () => {
  await assert.rejects(() => verifyExternalMonitoringAlerting({ evidenceUrl: URL, evidenceToken: 'short', productionOrigin: ORIGIN, now: NOW, fetchImpl: async () => response(attestation()) }), /at least 32/);
  await assert.rejects(() => verifyExternalMonitoringAlerting({ evidenceUrl: URL, evidenceToken: TOKEN, productionOrigin: ORIGIN, now: NOW, fetchImpl: async () => response(attestation(), { contentType: 'text/plain' }) }), /application\/json/);
});

test('writes evidence exclusively and preserves an existing artifact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd289-'));
  const path = join(dir, 'monitoring.json');
  const artifact = await verifyExternalMonitoringAlerting({ evidenceUrl: URL, evidenceToken: TOKEN, productionOrigin: ORIGIN, now: NOW, fetchImpl: async () => response(attestation()) });
  const written = await writeExternalMonitoringEvidence(path, artifact);
  assert.match(written.sha256, /^[0-9a-f]{64}$/);
  const original = await readFile(path);
  await assert.rejects(() => writeExternalMonitoringEvidence(path, { ...artifact, providerName: 'Other' }), (error) => error?.code === 'EEXIST');
  assert.deepEqual(await readFile(path), original);
  await writeFile(join(dir, 'sentinel.txt'), 'ok');
});

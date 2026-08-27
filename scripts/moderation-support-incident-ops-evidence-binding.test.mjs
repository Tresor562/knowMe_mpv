import test from 'node:test';
import assert from 'node:assert/strict';
import { createModerationSupportIncidentOpsEvidenceItem, validateModerationSupportIncidentOpsArtifact } from './moderation-support-incident-ops-evidence-binding.mjs';

const NOW = new Date('2026-08-27T19:30:00.000Z');
function artifact() {
  return {
    schemaVersion: 1,
    kind: 'knowme-moderation-support-incident-ops-drill',
    status: 'PASSED',
    observedAt: '2026-08-27T19:00:00.000Z',
    environment: 'PRODUCTION',
    checks: {
      reportIntake: 'PASSED', reportResolution: 'PASSED', userSuspension: 'PASSED',
      auditTrail: 'PASSED', supportEscalation: 'PASSED', incidentRunbookExercise: 'PASSED',
    },
    runbookSha256: 'a'.repeat(64),
    incidentRecordSha256: 'b'.repeat(64),
    proofBoundary: 'This artifact proves only the recorded production moderation, support, and incident-operations drill; it does not prove staffing levels, legal compliance, or future incident response performance.',
  };
}

test('accepts exact PASSED production drill artifact', () => {
  assert.deepEqual(validateModerationSupportIncidentOpsArtifact(artifact(), { now: NOW }), { ok: true, verifiedAt: artifact().observedAt });
});

test('rejects unknown fields and incomplete operational checks', () => {
  const extra = { ...artifact(), extra: true };
  assert.equal(validateModerationSupportIncidentOpsArtifact(extra, { now: NOW }).ok, false);
  const failed = artifact(); failed.checks.supportEscalation = 'FAILED';
  assert.match(validateModerationSupportIncidentOpsArtifact(failed, { now: NOW }).errors.join(' '), /supportEscalation/);
});

test('rejects malformed digests and future observations', () => {
  const bad = artifact(); bad.runbookSha256 = 'ABC'; bad.observedAt = '2026-08-28T00:00:00.000Z';
  const result = validateModerationSupportIncidentOpsArtifact(bad, { now: NOW });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /runbookSha256/);
  assert.match(result.errors.join(' '), /future/);
});

test('creates only moderation_support_incident_ops VERIFIED item from exact bytes', () => {
  const bytes = Buffer.from(JSON.stringify(artifact()));
  const result = createModerationSupportIncidentOpsEvidenceItem(bytes, {
    scope: 'WEB_V1', verifier: 'release-operator', evidenceRef: 'evidence://ops/drill-2026-08-27',
    validUntil: '2026-09-27T19:00:00.000Z', now: NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.item.id, 'moderation_support_incident_ops');
  assert.equal(result.item.status, 'VERIFIED');
  assert.match(result.item.evidenceSha256, /^[0-9a-f]{64}$/);
});

test('rejects invalid JSON and unsafe generic evidence metadata', () => {
  assert.equal(createModerationSupportIncidentOpsEvidenceItem(Buffer.from('{'), { now: NOW }).ok, false);
  const result = createModerationSupportIncidentOpsEvidenceItem(Buffer.from(JSON.stringify(artifact())), {
    scope: 'WEB_V1', verifier: ' release-operator ', evidenceRef: 'http://example.com/evidence',
    validUntil: '2026-09-27T19:00:00.000Z', now: NOW,
  });
  assert.equal(result.ok, false);
});

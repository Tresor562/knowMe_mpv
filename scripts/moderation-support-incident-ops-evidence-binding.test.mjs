import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createModerationSupportIncidentOpsEvidenceItem, validateModerationSupportIncidentOpsArtifact } from './moderation-support-incident-ops-evidence-binding.mjs';

const NOW = new Date('2026-08-27T19:30:00.000Z');
const VALID_UNTIL = '2026-09-27T19:00:00.000Z';
const cliPath = fileURLToPath(new URL('./moderation-support-incident-ops-evidence-binding.mjs', import.meta.url));

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
    '--ref', 'evidence://knowme/moderation-support-incident-ops/cli',
    '--valid-until', VALID_UNTIL,
  ];
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
  const retained = bytes();
  const result = createModerationSupportIncidentOpsEvidenceItem(retained, {
    scope: 'WEB_V1', verifier: 'release-operator', evidenceRef: 'evidence://ops/drill-2026-08-27',
    validUntil: VALID_UNTIL, now: NOW,
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
    validUntil: VALID_UNTIL, now: NOW,
  });
  assert.equal(result.ok, false);
});

test('CLI creates moderation/support incident evidence from a regular retained artifact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-moderation-ops-binding-'));
  try {
    const artifactPath = join(dir, 'moderation-ops.json');
    const outputPath = join(dir, 'item.json');
    await writeFile(artifactPath, bytes());

    const result = spawnSync(process.execPath, cliArgs(artifactPath, outputPath), { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const item = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(item.id, 'moderation_support_incident_ops');
    assert.equal(item.status, 'VERIFIED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CLI rejects a symlinked moderation/support incident artifact before JSON ingestion', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Symlink creation is not reliably available on Windows CI without elevated privileges.');
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), 'knowme-moderation-ops-binding-symlink-'));
  try {
    const targetPath = join(dir, 'moderation-ops-target.json');
    const artifactPath = join(dir, 'moderation-ops-link.json');
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

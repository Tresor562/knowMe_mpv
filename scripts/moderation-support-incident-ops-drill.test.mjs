import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildModerationSupportIncidentOpsArtifact,
  validateModerationOpsDrillRecord,
  writeModerationSupportIncidentOpsArtifact,
} from './moderation-support-incident-ops-drill.mjs';

const NOW = new Date('2026-08-27T22:00:00.000Z');
const CONFIRMATION = 'MODERATION_OPS_DRILL_COMPLETED';

function record(overrides = {}) {
  const completedAt = '2026-08-27T21:55:00.000Z';
  return {
    schemaVersion: 1,
    kind: 'knowme-moderation-support-incident-ops-record',
    environment: 'PRODUCTION',
    status: 'PASSED',
    observedAt: '2026-08-27T21:59:00.000Z',
    checks: {
      reportIntake: { status: 'PASSED', completedAt },
      reportResolution: { status: 'PASSED', completedAt },
      userSuspension: { status: 'PASSED', completedAt },
      auditTrail: { status: 'PASSED', completedAt },
      supportEscalation: { status: 'PASSED', completedAt },
      incidentRunbookExercise: { status: 'PASSED', completedAt },
    },
    ...overrides,
  };
}

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd295-'));
  const runbookPath = join(dir, 'runbook.md');
  const incidentRecordPath = join(dir, 'incident.json');
  const outputPath = join(dir, 'artifact.json');
  const runbookBytes = Buffer.from('# Incident runbook\nEscalate, contain, recover.\n');
  const incidentRecordBytes = Buffer.from(`${JSON.stringify(record(), null, 2)}\n`);
  await writeFile(runbookPath, runbookBytes);
  await writeFile(incidentRecordPath, incidentRecordBytes);
  return { dir, runbookPath, incidentRecordPath, outputPath, runbookBytes, incidentRecordBytes };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('validates the exact six-check production drill record', () => {
  assert.deepEqual(validateModerationOpsDrillRecord(record(), { now: NOW }), {
    ok: true,
    observedAt: '2026-08-27T21:59:00.000Z',
  });
});

test('rejects unknown fields, incomplete checks, future checks, and non-passed checks', () => {
  assert.equal(validateModerationOpsDrillRecord({ ...record(), extra: true }, { now: NOW }).ok, false);

  const incomplete = record();
  delete incomplete.checks.auditTrail;
  assert.equal(validateModerationOpsDrillRecord(incomplete, { now: NOW }).ok, false);

  const future = record();
  future.checks.auditTrail.completedAt = '2026-08-27T22:10:00.000Z';
  assert.equal(validateModerationOpsDrillRecord(future, { now: NOW }).ok, false);

  const failed = record();
  failed.checks.supportEscalation.status = 'FAILED';
  assert.equal(validateModerationOpsDrillRecord(failed, { now: NOW }).ok, false);
});

test('binds exact runbook and incident-record bytes into the KMD-293 artifact contract', async () => {
  const fx = await fixture();
  const artifact = await buildModerationSupportIncidentOpsArtifact({
    runbookPath: fx.runbookPath,
    incidentRecordPath: fx.incidentRecordPath,
    confirmation: CONFIRMATION,
    now: NOW,
  });

  assert.equal(artifact.schemaVersion, 1);
  assert.equal(artifact.kind, 'knowme-moderation-support-incident-ops-drill');
  assert.equal(artifact.status, 'PASSED');
  assert.equal(artifact.environment, 'PRODUCTION');
  assert.equal(artifact.observedAt, '2026-08-27T21:59:00.000Z');
  assert.equal(artifact.runbookSha256, sha256(fx.runbookBytes));
  assert.equal(artifact.incidentRecordSha256, sha256(fx.incidentRecordBytes));
  assert.deepEqual(Object.values(artifact.checks), Array(6).fill('PASSED'));
});

test('refuses to build without the exact destructive/operational confirmation', async () => {
  const fx = await fixture();
  await assert.rejects(
    buildModerationSupportIncidentOpsArtifact({
      runbookPath: fx.runbookPath,
      incidentRecordPath: fx.incidentRecordPath,
      confirmation: 'yes',
      now: NOW,
    }),
    /MODERATION_OPS_DRILL_COMPLETED/,
  );
});

test('rejects symlink inputs and malformed incident JSON', async () => {
  const fx = await fixture();
  const symlinkPath = join(fx.dir, 'runbook-link.md');
  await symlink(fx.runbookPath, symlinkPath);
  await assert.rejects(
    buildModerationSupportIncidentOpsArtifact({
      runbookPath: symlinkPath,
      incidentRecordPath: fx.incidentRecordPath,
      confirmation: CONFIRMATION,
      now: NOW,
    }),
    /regular non-symlink file/,
  );

  await writeFile(fx.incidentRecordPath, '{bad json');
  await assert.rejects(
    buildModerationSupportIncidentOpsArtifact({
      runbookPath: fx.runbookPath,
      incidentRecordPath: fx.incidentRecordPath,
      confirmation: CONFIRMATION,
      now: NOW,
    }),
    /valid JSON/,
  );
});

test('writes atomically and never overwrites or deletes a pre-existing artifact', async () => {
  const fx = await fixture();
  const artifact = await buildModerationSupportIncidentOpsArtifact({
    runbookPath: fx.runbookPath,
    incidentRecordPath: fx.incidentRecordPath,
    confirmation: CONFIRMATION,
    now: NOW,
  });

  const first = await writeModerationSupportIncidentOpsArtifact(fx.outputPath, artifact);
  assert.equal(first.sha256, sha256(first.bytes));
  const original = await readFile(fx.outputPath);

  await assert.rejects(writeModerationSupportIncidentOpsArtifact(fx.outputPath, { ...artifact, observedAt: NOW.toISOString() }), {
    code: 'EEXIST',
  });
  assert.deepEqual(await readFile(fx.outputPath), original);
});

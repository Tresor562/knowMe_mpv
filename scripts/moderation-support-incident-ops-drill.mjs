#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, open, readFile, unlink } from 'node:fs/promises';

const CONFIRMATION = 'MODERATION_OPS_DRILL_COMPLETED';
const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const CHECK_NAMES = [
  'reportIntake',
  'reportResolution',
  'userSuspension',
  'auditTrail',
  'supportEscalation',
  'incidentRunbookExercise',
];
const RECORD_FIELDS = new Set(['schemaVersion', 'kind', 'environment', 'status', 'observedAt', 'checks']);
const CHECK_FIELDS = new Set(['status', 'completedAt']);
const PROOF_BOUNDARY = 'This artifact proves only the recorded production moderation, support, and incident-operations drill; it does not prove staffing levels, legal compliance, or future incident response performance.';

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalPath(value) {
  return nonEmpty(value) && value === value.trim() && !CONTROL_CHARACTERS.test(value) ? value : null;
}

function canonicalUtcTimestamp(value) {
  if (!nonEmpty(value) || value !== value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function exactFields(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

async function readRegularFile(path, label) {
  if (!canonicalPath(path)) throw new Error(`${label} path must be canonical and free of control characters.`);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file.`);
  if (info.size < 1 || info.size > MAX_INPUT_BYTES) {
    throw new Error(`${label} must contain between 1 and ${MAX_INPUT_BYTES} bytes.`);
  }
  return readFile(path);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function validateModerationOpsDrillRecord(record, { now = new Date() } = {}) {
  const errors = [];
  if (!exactFields(record, RECORD_FIELDS)) {
    return { ok: false, errors: ['Incident record must match the exact KMD-295 schema-v1 contract.'] };
  }
  if (record.schemaVersion !== 1) errors.push('schemaVersion must equal 1.');
  if (record.kind !== 'knowme-moderation-support-incident-ops-record') errors.push('kind is invalid.');
  if (record.environment !== 'PRODUCTION') errors.push('environment must equal PRODUCTION.');
  if (record.status !== 'PASSED') errors.push('status must equal PASSED.');

  const observedAt = canonicalUtcTimestamp(record.observedAt);
  const nowMs = now instanceof Date && Number.isFinite(now.getTime()) ? now.getTime() : NaN;
  if (observedAt === null) errors.push('observedAt must be a canonical UTC timestamp.');
  else if (Number.isFinite(nowMs) && observedAt > nowMs + 5 * 60_000) errors.push('observedAt must not be in the future.');

  const expectedChecks = new Set(CHECK_NAMES);
  if (!exactFields(record.checks, expectedChecks)) {
    errors.push('checks must contain exactly the six KMD-295 operational checks.');
  } else {
    for (const name of CHECK_NAMES) {
      const check = record.checks[name];
      if (!exactFields(check, CHECK_FIELDS)) {
        errors.push(`${name} must contain only status and completedAt.`);
        continue;
      }
      if (check.status !== 'PASSED') errors.push(`${name}.status must equal PASSED.`);
      const completedAt = canonicalUtcTimestamp(check.completedAt);
      if (completedAt === null) errors.push(`${name}.completedAt must be canonical UTC.`);
      else {
        if (Number.isFinite(nowMs) && completedAt > nowMs + 5 * 60_000) errors.push(`${name}.completedAt must not be in the future.`);
        if (observedAt !== null && completedAt > observedAt) errors.push(`${name}.completedAt must not be later than observedAt.`);
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, observedAt: record.observedAt };
}

export async function buildModerationSupportIncidentOpsArtifact({
  runbookPath,
  incidentRecordPath,
  confirmation,
  now = new Date(),
} = {}) {
  if (confirmation !== CONFIRMATION) {
    throw new Error(`Explicit confirmation must equal ${CONFIRMATION}.`);
  }

  const [runbookBytes, incidentRecordBytes] = await Promise.all([
    readRegularFile(runbookPath, 'Runbook'),
    readRegularFile(incidentRecordPath, 'Incident record'),
  ]);

  let record;
  try {
    record = JSON.parse(incidentRecordBytes.toString('utf8'));
  } catch {
    throw new Error('Incident record must contain valid JSON.');
  }

  const validation = validateModerationOpsDrillRecord(record, { now });
  if (!validation.ok) throw new Error(validation.errors.join(' '));

  return {
    schemaVersion: 1,
    kind: 'knowme-moderation-support-incident-ops-drill',
    status: 'PASSED',
    observedAt: validation.observedAt,
    environment: 'PRODUCTION',
    checks: Object.fromEntries(CHECK_NAMES.map((name) => [name, 'PASSED'])),
    runbookSha256: sha256(runbookBytes),
    incidentRecordSha256: sha256(incidentRecordBytes),
    proofBoundary: PROOF_BOUNDARY,
  };
}

export async function writeModerationSupportIncidentOpsArtifact(outputPath, artifact) {
  if (!canonicalPath(outputPath)) throw new Error('Output path must be canonical and free of control characters.');
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  let created = false;
  let handle;
  try {
    handle = await open(outputPath, 'wx', 0o600);
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    if (created) await unlink(outputPath).catch(() => {});
    throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
  return { bytes, sha256: sha256(bytes) };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const runbookPath = readArg('--runbook');
  const incidentRecordPath = readArg('--incident-record');
  const outputPath = readArg('--output');
  const confirmation = readArg('--confirm') ?? process.env.KNOWME_MODERATION_OPS_DRILL_CONFIRM;
  if (!runbookPath || !incidentRecordPath || !outputPath) {
    throw new Error('Provide --runbook <file>, --incident-record <file>, and --output <artifact.json>.');
  }

  const artifact = await buildModerationSupportIncidentOpsArtifact({
    runbookPath,
    incidentRecordPath,
    confirmation,
  });
  const written = await writeModerationSupportIncidentOpsArtifact(outputPath, artifact);
  console.log(`Moderation/support incident-ops drill artifact written to ${outputPath}.`);
  console.log(`SHA-256: ${written.sha256}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Moderation/support incident-ops drill artifact creation failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

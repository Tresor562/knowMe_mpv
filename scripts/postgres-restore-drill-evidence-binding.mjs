#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { createMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

function canonicalTimestamp(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function positiveFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function validateRestoreDrillArtifact(artifact, { now = new Date() } = {}) {
  const errors = [];
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return { ok: false, errors: ['Restore drill artifact must be a JSON object.'] };
  }
  if (artifact.schemaVersion !== 2) errors.push('Restore drill artifact schemaVersion must be 2.');
  if (artifact.kind !== 'knowme-postgres-restore-drill') errors.push('Restore drill artifact kind is invalid.');
  if (artifact.status !== 'PASSED') errors.push('Restore drill artifact status must be PASSED.');

  const observedAt = canonicalTimestamp(artifact.observedAt);
  const nowMs = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : NaN;
  if (observedAt === null) errors.push('Restore drill observedAt must be a canonical UTC timestamp.');
  else if (Number.isFinite(nowMs) && observedAt > nowMs + 5 * 60_000) errors.push('Restore drill observedAt must not be in the future.');

  if (artifact.restore?.isolatedTarget !== true) errors.push('Restore drill must prove an isolated target.');
  const checks = artifact.restore?.checks;
  if (checks?.databaseReachable !== true || checks?.prismaMigrationsTable !== true || checks?.schemaHasTables !== true) {
    errors.push('Restore drill bounded PostgreSQL checks must all pass.');
  }

  const recovery = artifact.restore?.recovery;
  const startedAt = canonicalTimestamp(recovery?.startedAt);
  const completedAt = canonicalTimestamp(recovery?.completedAt);
  if (startedAt === null || completedAt === null || completedAt < startedAt) {
    errors.push('Restore drill recovery timestamps are invalid.');
  }
  if (observedAt !== null && completedAt !== null && observedAt !== completedAt) {
    errors.push('Restore drill observedAt must equal recovery.completedAt.');
  }
  if (!positiveFinite(recovery?.recoveryPointAgeSeconds)) errors.push('Restore drill recoveryPointAgeSeconds is invalid.');
  if (!positiveFinite(recovery?.restoreDurationMs)) errors.push('Restore drill restoreDurationMs is invalid.');
  if (!Number.isInteger(recovery?.policy?.maxRpoHours) || recovery.policy.maxRpoHours < 1 || recovery.policy.maxRpoHours > 8760) {
    errors.push('Restore drill maxRpoHours policy is invalid.');
  }
  if (!Number.isInteger(recovery?.policy?.maxRtoSeconds) || recovery.policy.maxRtoSeconds < 1 || recovery.policy.maxRtoSeconds > 86400) {
    errors.push('Restore drill maxRtoSeconds policy is invalid.');
  }
  if (
    positiveFinite(recovery?.recoveryPointAgeSeconds) &&
    Number.isInteger(recovery?.policy?.maxRpoHours) &&
    recovery.recoveryPointAgeSeconds > recovery.policy.maxRpoHours * 3600
  ) errors.push('Restore drill artifact exceeds its recorded RPO policy.');
  if (
    positiveFinite(recovery?.restoreDurationMs) &&
    Number.isInteger(recovery?.policy?.maxRtoSeconds) &&
    recovery.restoreDurationMs > recovery.policy.maxRtoSeconds * 1000
  ) errors.push('Restore drill artifact exceeds its recorded RTO policy.');

  return errors.length ? { ok: false, errors } : { ok: true, verifiedAt: artifact.observedAt };
}

export function createRestoreDrillMarketEvidenceItem(artifactBytes, options = {}) {
  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(artifactBytes).toString('utf8'));
  } catch {
    return { ok: false, errors: ['Restore drill artifact must contain valid JSON.'] };
  }
  const validation = validateRestoreDrillArtifact(artifact, { now: options.now });
  if (!validation.ok) return validation;
  return createMarketReleaseEvidenceItem(artifactBytes, {
    id: 'backup_restore_drill',
    scope: options.scope,
    verifier: options.verifier,
    evidenceRef: options.evidenceRef,
    verifiedAt: validation.verifiedAt,
    validUntil: options.validUntil,
    now: options.now,
  });
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const artifactPath = arg('--artifact');
  const outputPath = arg('--output');
  const scope = arg('--scope');
  const verifier = arg('--verifier');
  const evidenceRef = arg('--ref');
  const validUntil = arg('--valid-until');
  if (!artifactPath || !outputPath || !scope || !verifier || !evidenceRef || !validUntil) {
    throw new Error('Provide --artifact, --output, --scope, --verifier, --ref, and --valid-until.');
  }
  const bytes = await readRetainedEvidenceFile(artifactPath, 'restore drill retained artifact', {
    maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.artifact,
  });
  const result = createRestoreDrillMarketEvidenceItem(bytes, { scope, verifier, evidenceRef, validUntil });
  if (!result.ok) throw new Error(result.errors.join(' '));
  await writeFile(outputPath, `${JSON.stringify(result.item, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log(`Created VERIFIED backup_restore_drill evidence item at ${outputPath}.`);
  console.log(`SHA-256: ${result.item.evidenceSha256}`);
  console.log('The item still must be applied to the unsigned release manifest, signed, and pass check:market-ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Restore drill evidence binding failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

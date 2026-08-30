#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { open, rm } from 'node:fs/promises';
import {
  assertRestoreTargetIsolation,
  postgresCliConnection,
  requireBackupManifestSigningKey,
  requireDumpPath,
  requirePostgresUrl,
  sha256File,
  validateBackupManifest,
  verifyBackupManifestAuthenticity,
} from './postgres-backup-lib.mjs';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

const RESTORE_DRILL_CONFIRMATION = 'RESTORE_DRILL_KNOWME';
const RESTORE_SCRIPT_PATH = fileURLToPath(new URL('./postgres-restore.mjs', import.meta.url));
const MAX_DRILL_AGE_HOURS = 8760;
const MAX_DRILL_RTO_SECONDS = 86400;
const CHECK_SQL = `SELECT json_build_object(
  'databaseReachable', true,
  'prismaMigrationsTable', to_regclass('public._prisma_migrations') IS NOT NULL,
  'publicTableCount', (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public')
)::text;`;

function canonicalPositiveInteger(raw, label, max = Number.MAX_SAFE_INTEGER) {
  if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw)) {
    throw new Error(`${label} must be a canonical positive integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > max) {
    throw new Error(`${label} must be between 1 and ${max}`);
  }
  return value;
}

export function resolveRestoreDrillMaxAgeHours(raw) {
  return canonicalPositiveInteger(raw, 'Restore drill max age hours', MAX_DRILL_AGE_HOURS);
}

export function resolveRestoreDrillMaxRtoSeconds(raw) {
  return canonicalPositiveInteger(raw, 'Restore drill max RTO seconds', MAX_DRILL_RTO_SECONDS);
}

export function assertRestoreDrillConfirmation(value) {
  if (value !== RESTORE_DRILL_CONFIRMATION) {
    throw new Error(`Restore drill refused: pass --confirm ${RESTORE_DRILL_CONFIRMATION}`);
  }
}

export function parseRestoreDrillCheckOutput(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(String(stdout).trim());
  } catch {
    throw new Error('Restore drill integrity check returned invalid JSON');
  }

  if (
    !parsed ||
    parsed.databaseReachable !== true ||
    parsed.prismaMigrationsTable !== true ||
    !Number.isInteger(parsed.publicTableCount) ||
    parsed.publicTableCount < 1
  ) {
    throw new Error('Restore drill integrity checks did not prove a usable restored schema');
  }

  return {
    databaseReachable: true,
    prismaMigrationsTable: true,
    publicTableCount: parsed.publicTableCount,
  };
}

export function buildRestoreDrillRecoveryMetrics({
  manifest,
  startedAt,
  completedAt,
  durationMs,
  maxRpoHours,
  maxRtoSeconds,
}) {
  const started = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const completed = completedAt instanceof Date ? completedAt : new Date(completedAt);
  const backupCreatedAt = new Date(manifest.createdAt);
  if ([started, completed, backupCreatedAt].some((date) => Number.isNaN(date.getTime()))) {
    throw new Error('Restore drill recovery timestamps are invalid');
  }
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error('Restore drill duration is invalid');
  }

  const recoveryPointAgeSeconds = (started.getTime() - backupCreatedAt.getTime()) / 1000;
  if (!Number.isFinite(recoveryPointAgeSeconds) || recoveryPointAgeSeconds < 0) {
    throw new Error('Restore drill backup timestamp is in the future');
  }

  const maxRpoSeconds = maxRpoHours * 3600;
  if (recoveryPointAgeSeconds > maxRpoSeconds) {
    throw new Error(
      `Restore drill RPO policy failed: backup age ${recoveryPointAgeSeconds.toFixed(3)}s exceeds ${maxRpoSeconds}s`,
    );
  }
  if (durationMs > maxRtoSeconds * 1000) {
    throw new Error(
      `Restore drill RTO policy failed: duration ${durationMs.toFixed(3)}ms exceeds ${maxRtoSeconds * 1000}ms`,
    );
  }

  return {
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    recoveryPointAgeSeconds,
    restoreDurationMs: durationMs,
    policy: {
      maxRpoHours,
      maxRtoSeconds,
    },
  };
}

export function buildRestoreDrillEvidence({ manifest, checks, recovery, observedAt = new Date() }) {
  const observed = observedAt instanceof Date ? observedAt : new Date(observedAt);
  if (Number.isNaN(observed.getTime())) throw new Error('Restore drill observation time is invalid');

  return {
    schemaVersion: 2,
    kind: 'knowme-postgres-restore-drill',
    status: 'PASSED',
    observedAt: observed.toISOString(),
    backup: {
      file: manifest.file,
      sha256: manifest.sha256,
      createdAt: manifest.createdAt,
      manifestSchemaVersion: manifest.schemaVersion,
    },
    restore: {
      isolatedTarget: true,
      checks,
      recovery,
    },
    proofBoundary:
      'This artifact proves this automated isolated restore drill completed, passed bounded PostgreSQL schema checks, and met the configured RPO/RTO thresholds during this run. It does not prove remote backup durability, production failover, business-data correctness, or future RPO/RTO performance.',
  };
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function reserveEvidenceOutput(outputPath) {
  if (typeof outputPath !== 'string' || !outputPath.trim()) {
    throw new Error('Restore drill evidence output path is required');
  }
  const path = resolve(outputPath);
  if (!path.endsWith('.json')) throw new Error('Restore drill evidence output must use the .json extension');
  const handle = await open(path, 'wx', 0o600);
  return { path, handle };
}

async function cleanupReservation(reservation) {
  if (!reservation) return;
  try {
    await reservation.handle.close();
  } catch {}
  await rm(reservation.path, { force: true });
}

export async function runPostgresRestoreDrill({
  dumpPath,
  outputPath,
  maxAgeHours,
  maxRtoSeconds,
  confirmation,
  env = process.env,
  spawn = spawnSync,
  now = new Date(),
  monotonicNow = () => performance.now(),
  completedAt = () => new Date(),
}) {
  assertRestoreDrillConfirmation(confirmation);
  const dump = requireDumpPath(dumpPath);
  const maxAge = resolveRestoreDrillMaxAgeHours(String(maxAgeHours));
  const maxRto = resolveRestoreDrillMaxRtoSeconds(String(maxRtoSeconds));
  const restoreDatabaseUrl = requirePostgresUrl(env.RESTORE_DATABASE_URL, 'RESTORE_DATABASE_URL');
  assertRestoreTargetIsolation(restoreDatabaseUrl, env.DATABASE_URL, undefined);

  const manifestPath = `${dump}.manifest.json`;
  let manifest;
  try {
    manifest = JSON.parse(
      await readRetainedEvidenceFile(manifestPath, 'Backup manifest', {
        encoding: 'utf8',
        maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.manifest,
      }),
    );
  } catch {
    throw new Error(`Backup manifest is missing or invalid: ${manifestPath}`);
  }

  validateBackupManifest(manifest, dump, { now, maxAgeHours: maxAge });
  const signingKey = requireBackupManifestSigningKey(env.KNOWME_BACKUP_MANIFEST_SIGNING_KEY);
  verifyBackupManifestAuthenticity(manifest, signingKey);
  if (sha256File(dump) !== manifest.sha256) {
    throw new Error('Backup integrity check failed before restore drill');
  }

  const reservation = await reserveEvidenceOutput(outputPath);
  let completed = false;
  const startedMonotonic = monotonicNow();
  try {
    const restoreResult = spawn(
      process.execPath,
      [
        RESTORE_SCRIPT_PATH,
        '--file',
        dump,
        '--confirm',
        'RESTORE_KNOWME',
        '--max-age-hours',
        String(maxAge),
      ],
      {
        encoding: 'utf8',
        env: { ...env },
      },
    );
    if (restoreResult.error) throw restoreResult.error;
    if (restoreResult.status !== 0) {
      throw new Error(`Restore drill pg_restore phase failed with exit code ${restoreResult.status}`);
    }

    const connection = postgresCliConnection(restoreDatabaseUrl, 'RESTORE_DATABASE_URL');
    const checkResult = spawn(
      'psql',
      [
        '--no-psqlrc',
        '--set=ON_ERROR_STOP=1',
        '--tuples-only',
        '--no-align',
        '--command',
        CHECK_SQL,
        connection.url,
      ],
      {
        encoding: 'utf8',
        env: { ...env, ...connection.env },
      },
    );
    if (checkResult.error) throw checkResult.error;
    if (checkResult.status !== 0) {
      throw new Error(`Restore drill PostgreSQL integrity phase failed with exit code ${checkResult.status}`);
    }

    const checks = parseRestoreDrillCheckOutput(checkResult.stdout);
    const finishedMonotonic = monotonicNow();
    const finishedAt = completedAt();
    const recovery = buildRestoreDrillRecoveryMetrics({
      manifest,
      startedAt: now,
      completedAt: finishedAt,
      durationMs: finishedMonotonic - startedMonotonic,
      maxRpoHours: maxAge,
      maxRtoSeconds: maxRto,
    });
    const evidence = buildRestoreDrillEvidence({ manifest, checks, recovery, observedAt: finishedAt });
    const bytes = Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    await reservation.handle.writeFile(bytes);
    await reservation.handle.sync();
    await reservation.handle.close();
    completed = true;

    return {
      outputPath: reservation.path,
      sha256: sha256Bytes(bytes),
      evidence,
    };
  } finally {
    if (!completed) await cleanupReservation(reservation);
  }
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const result = await runPostgresRestoreDrill({
    dumpPath: argValue('--file'),
    outputPath: argValue('--output'),
    maxAgeHours: argValue('--max-age-hours'),
    maxRtoSeconds: argValue('--max-rto-seconds'),
    confirmation: argValue('--confirm'),
  });

  console.log(`Restore drill evidence written: ${result.outputPath}`);
  console.log(`Restore drill evidence SHA-256: ${result.sha256}`);
  console.log(
    `Restore drill recovery metrics: RPO=${result.evidence.restore.recovery.recoveryPointAgeSeconds}s, RTO=${result.evidence.restore.recovery.restoreDurationMs}ms`,
  );
  console.log('The drill used an isolated RESTORE_DATABASE_URL and passed bounded PostgreSQL schema checks.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(`Restore drill failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

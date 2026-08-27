#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, readFile } from 'node:fs/promises';
import {
  assertRestoreTargetIsolation,
  manifestForBackup,
  postgresCliConnection,
  requireBackupManifestSigningKey,
  requireDumpPath,
  requirePostgresUrl,
  sha256File,
  validateBackupManifest,
  verifyBackupManifestAuthenticity,
} from './postgres-backup-lib.mjs';

const RESTORE_DRILL_CONFIRMATION = 'RESTORE_DRILL_KNOWME';
const RESTORE_SCRIPT_PATH = fileURLToPath(new URL('./postgres-restore.mjs', import.meta.url));
const MAX_DRILL_AGE_HOURS = 8760;
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

export function buildRestoreDrillEvidence({ manifest, checks, maxAgeHours, observedAt = new Date() }) {
  const observed = observedAt instanceof Date ? observedAt : new Date(observedAt);
  if (Number.isNaN(observed.getTime())) throw new Error('Restore drill observation time is invalid');

  return {
    schemaVersion: 1,
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
      maxAgeHours,
      checks,
    },
    proofBoundary:
      'This artifact proves this automated isolated restore drill completed and its bounded PostgreSQL schema checks passed. It does not prove remote backup durability, production failover, business-data correctness, or an achieved RPO/RTO outside this run.',
  };
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function writeExclusiveEvidence(outputPath, bytes) {
  const path = resolve(outputPath);
  if (!path.endsWith('.json')) throw new Error('Restore drill evidence output must use the .json extension');

  const handle = await open(path, 'wx', 0o600);
  let created = true;
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    try {
      await handle.close();
    } finally {
      if (created) {
        const { rm } = await import('node:fs/promises');
        await rm(path, { force: true });
      }
    }
    throw error;
  }
  await handle.close();
  created = false;
  return path;
}

export async function runPostgresRestoreDrill({
  dumpPath,
  outputPath,
  maxAgeHours,
  confirmation,
  env = process.env,
  spawn = spawnSync,
  now = new Date(),
}) {
  assertRestoreDrillConfirmation(confirmation);
  const dump = requireDumpPath(dumpPath);
  const maxAge = resolveRestoreDrillMaxAgeHours(String(maxAgeHours));
  const restoreDatabaseUrl = requirePostgresUrl(env.RESTORE_DATABASE_URL, 'RESTORE_DATABASE_URL');
  assertRestoreTargetIsolation(restoreDatabaseUrl, env.DATABASE_URL, undefined);

  const manifestPath = `${dump}.manifest.json`;
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    throw new Error(`Backup manifest is missing or invalid: ${manifestPath}`);
  }

  validateBackupManifest(manifest, dump, { now, maxAgeHours: maxAge });
  const signingKey = requireBackupManifestSigningKey(env.KNOWME_BACKUP_MANIFEST_SIGNING_KEY);
  verifyBackupManifestAuthenticity(manifest, signingKey);
  if (sha256File(dump) !== manifest.sha256) {
    throw new Error('Backup integrity check failed before restore drill');
  }

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
      connection.url,
      '--no-psqlrc',
      '--set=ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
      '--command',
      CHECK_SQL,
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
  const evidence = buildRestoreDrillEvidence({ manifest, checks, maxAgeHours: maxAge, observedAt: now });
  const bytes = Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  const writtenPath = await writeExclusiveEvidence(outputPath, bytes);

  return {
    outputPath: writtenPath,
    sha256: sha256Bytes(bytes),
    evidence,
  };
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
    confirmation: argValue('--confirm'),
  });

  console.log(`Restore drill evidence written: ${result.outputPath}`);
  console.log(`Restore drill evidence SHA-256: ${result.sha256}`);
  console.log('The drill used an isolated RESTORE_DATABASE_URL and passed bounded PostgreSQL schema checks.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(`Restore drill failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

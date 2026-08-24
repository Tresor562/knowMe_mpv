#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  assertRestoreConfirmation,
  buildRestoreArgs,
  requireDumpPath,
  requirePostgresUrl,
  sha256File,
  validateBackupManifest,
} from './postgres-backup-lib.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function optionalPositiveNumber(name) {
  const value = argValue(name);
  if (value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return parsed;
}

try {
  const dumpPath = requireDumpPath(argValue('--file'));
  const confirmation = argValue('--confirm');
  assertRestoreConfirmation(confirmation);
  const maxAgeHours = optionalPositiveNumber('--max-age-hours');

  const databaseUrl = requirePostgresUrl(
    process.env.RESTORE_DATABASE_URL,
    'RESTORE_DATABASE_URL',
  );

  const manifestPath = `${dumpPath}.manifest.json`;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error(`Backup manifest is missing or invalid: ${manifestPath}`);
  }

  validateBackupManifest(manifest, dumpPath, { maxAgeHours });

  const actualSha256 = sha256File(dumpPath);
  if (actualSha256 !== manifest.sha256) {
    throw new Error('Backup integrity check failed: SHA-256 mismatch');
  }

  const result = spawnSync('pg_restore', buildRestoreArgs(databaseUrl, dumpPath), {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pg_restore failed with exit code ${result.status}`);
  }

  console.log('Restore completed successfully. Run application integrity checks before serving traffic.');
} catch (error) {
  console.error(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  assertRestoreConfirmation,
  buildRestoreArgs,
  requireDumpPath,
  requirePostgresUrl,
  sha256File,
} from './postgres-backup-lib.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

try {
  const dumpPath = requireDumpPath(argValue('--file'));
  const confirmation = argValue('--confirm');
  assertRestoreConfirmation(confirmation);

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

  if (!manifest || manifest.schemaVersion !== 1 || typeof manifest.sha256 !== 'string') {
    throw new Error('Backup manifest does not match the supported schema');
  }

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

#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  assertRestoreConfirmation,
  assertRestoreTargetIsolation,
  buildRestoreArgs,
  postgresCliConnection,
  requireBackupManifestSigningKey,
  requireDumpPath,
  requirePostgresUrl,
  sha256File,
  validateBackupManifest,
  verifyBackupManifestAuthenticity,
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
  const allowUnsignedLegacy =
    argValue('--allow-unsigned-legacy') === 'RESTORE_UNSIGNED_KNOWME';

  const databaseUrl = requirePostgresUrl(
    process.env.RESTORE_DATABASE_URL,
    'RESTORE_DATABASE_URL',
  );
  assertRestoreTargetIsolation(
    databaseUrl,
    process.env.DATABASE_URL,
    argValue('--allow-primary-restore'),
  );

  const manifestPath = `${dumpPath}.manifest.json`;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error(`Backup manifest is missing or invalid: ${manifestPath}`);
  }

  validateBackupManifest(manifest, dumpPath, { maxAgeHours });
  if (manifest.schemaVersion === 1 && allowUnsignedLegacy) {
    verifyBackupManifestAuthenticity(manifest, undefined, { allowUnsignedLegacy: true });
  } else {
    const signingKey = requireBackupManifestSigningKey(
      process.env.KNOWME_BACKUP_MANIFEST_SIGNING_KEY,
    );
    verifyBackupManifestAuthenticity(manifest, signingKey);
  }

  const actualSha256 = sha256File(dumpPath);
  if (actualSha256 !== manifest.sha256) {
    throw new Error('Backup integrity check failed: SHA-256 mismatch');
  }

  const connection = postgresCliConnection(databaseUrl, 'RESTORE_DATABASE_URL');
  const result = spawnSync('pg_restore', buildRestoreArgs(databaseUrl, dumpPath), {
    stdio: 'inherit',
    env: { ...process.env, ...connection.env },
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

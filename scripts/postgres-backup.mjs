#!/usr/bin/env node
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  assertBackupDestinationAvailable,
  backupManifestPath,
  buildBackupArgs,
  cleanupBackupArtifacts,
  manifestForBackup,
  requireDumpPath,
  requirePostgresUrl,
  sha256File,
} from './postgres-backup-lib.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

let output;
let backupStarted = false;

try {
  const databaseUrl = requirePostgresUrl(process.env.DATABASE_URL);
  output = requireDumpPath(
    argValue('--output') ||
      process.env.KNOWME_BACKUP_PATH ||
      resolve('.backups', `knowme-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`),
  );

  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
  assertBackupDestinationAvailable(output);

  backupStarted = true;
  const result = spawnSync('pg_dump', buildBackupArgs(databaseUrl, output), {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pg_dump failed with exit code ${result.status}`);
  }

  chmodSync(output, 0o600);
  const sha256 = sha256File(output);
  const manifest = manifestForBackup({ filePath: output, sha256 });
  const manifestPath = backupManifestPath(output);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
    flag: 'wx',
  });

  console.log(`Backup created: ${output}`);
  console.log(`Manifest created: ${manifestPath}`);
  console.log(`SHA-256: ${sha256}`);
} catch (error) {
  if (backupStarted && output) {
    try {
      cleanupBackupArtifacts(output);
    } catch (cleanupError) {
      console.error(
        `Backup cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
      );
    }
  }
  console.error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

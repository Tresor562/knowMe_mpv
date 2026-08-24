#!/usr/bin/env node
import { resolve } from 'node:path';
import { verifyBackupReadiness } from './postgres-backup-retention-lib.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

try {
  const directory =
    argValue('--directory') || process.env.KNOWME_BACKUP_DIRECTORY || resolve('.backups');
  const signingKey = process.env.KNOWME_BACKUP_MANIFEST_SIGNING_KEY;
  const keepMinimum =
    argValue('--keep-minimum') || process.env.KNOWME_BACKUP_KEEP_MINIMUM;
  const maxAgeHours =
    argValue('--max-age-hours') || process.env.KNOWME_BACKUP_MAX_AGE_HOURS;

  const result = verifyBackupReadiness({
    directory,
    signingKey,
    keepMinimum,
    maxAgeHours,
  });

  console.log(
    `Backup readiness passed: ${result.total} verified backup(s); newest age ${result.newestAgeHours.toFixed(2)} hour(s), maximum ${result.maxAgeHours}.`,
  );
} catch (error) {
  console.error(
    `Backup readiness failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

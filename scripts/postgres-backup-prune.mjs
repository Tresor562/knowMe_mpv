#!/usr/bin/env node
import {
  buildBackupRetentionPlan,
  executeBackupRetentionPlan,
} from './postgres-backup-retention-lib.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

try {
  const plan = buildBackupRetentionPlan({
    directory: argValue('--directory') || process.env.KNOWME_BACKUP_DIRECTORY || '.backups',
    signingKey: process.env.KNOWME_BACKUP_MANIFEST_SIGNING_KEY,
    retentionDays: argValue('--retention-days') || process.env.KNOWME_BACKUP_RETENTION_DAYS || '30',
    keepMinimum: argValue('--keep-minimum') || process.env.KNOWME_BACKUP_KEEP_MINIMUM || '3',
  });

  console.log(
    `Backup retention plan: ${plan.total} total, ${plan.retained} retained, ${plan.deletable.length} eligible for deletion.`,
  );
  for (const backup of plan.deletable) {
    console.log(`Eligible: ${backup.file} (${backup.createdAt.toISOString()})`);
  }

  const confirmation = argValue('--confirm');
  if (!confirmation) {
    console.log('Dry run only. Pass --confirm PRUNE_KNOWME to delete the eligible backup pairs.');
    process.exit(0);
  }

  const deleted = executeBackupRetentionPlan(plan, confirmation);
  console.log(`Backup retention completed: ${deleted} backup pair(s) deleted.`);
} catch (error) {
  console.error(`Backup retention failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

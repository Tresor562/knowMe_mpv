import { lstatSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  backupManifestPath,
  requireBackupManifestSigningKey,
  requireDumpPath,
  sha256File,
  validateBackupManifest,
  verifyBackupManifestAuthenticity,
} from './postgres-backup-lib.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function assertRegularFile(path, label) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular file and must not be a symbolic link`);
  }
}

function parseManifest(path) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`Backup manifest is unreadable or invalid JSON: ${basename(path)}`);
  }
  return value;
}

export function inspectBackupDirectory({ directory, signingKey, now = new Date() }) {
  const root = resolve(directory || '.backups');
  const key = requireBackupManifestSigningKey(signingKey);
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) throw new Error('Backup inspection clock is invalid');

  const dirents = readdirSync(root, { withFileTypes: true });
  const dumpNames = new Set(
    dirents.filter((entry) => entry.name.endsWith('.dump')).map((entry) => entry.name),
  );
  const manifestNames = new Set(
    dirents
      .filter((entry) => entry.name.endsWith('.dump.manifest.json'))
      .map((entry) => entry.name),
  );

  for (const dumpName of dumpNames) {
    if (!manifestNames.has(`${dumpName}.manifest.json`)) {
      throw new Error(`Backup dump has no matching manifest: ${dumpName}`);
    }
  }
  for (const manifestName of manifestNames) {
    const dumpName = manifestName.slice(0, -'.manifest.json'.length);
    if (!dumpNames.has(dumpName)) {
      throw new Error(`Backup manifest has no matching dump: ${manifestName}`);
    }
  }

  const backups = [];
  for (const dumpName of dumpNames) {
    const dumpPath = requireDumpPath(resolve(root, dumpName));
    const manifestPath = backupManifestPath(dumpPath);
    assertRegularFile(dumpPath, `Backup dump ${dumpName}`);
    assertRegularFile(manifestPath, `Backup manifest ${basename(manifestPath)}`);

    const manifest = parseManifest(manifestPath);
    verifyBackupManifestAuthenticity(manifest, key);
    validateBackupManifest(manifest, dumpPath, { now: current });
    if (sha256File(dumpPath).toLowerCase() !== manifest.sha256.toLowerCase()) {
      throw new Error(`Backup checksum does not match signed manifest: ${dumpName}`);
    }

    backups.push({
      dumpPath,
      manifestPath,
      file: dumpName,
      createdAt: new Date(manifest.createdAt),
    });
  }

  backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { directory: root, backups, now: current };
}

export function verifyBackupReadiness({
  directory,
  signingKey,
  keepMinimum,
  maxAgeHours,
  now = new Date(),
}) {
  const minimum = positiveInteger(keepMinimum, 'Backup minimum retained count');
  const maximumAge = positiveInteger(maxAgeHours, 'Backup maximum age hours');
  const inspection = inspectBackupDirectory({ directory, signingKey, now });
  const { backups, now: current } = inspection;

  if (backups.length < minimum) {
    throw new Error(
      `Backup readiness failed: found ${backups.length} verified backup(s), require at least ${minimum}`,
    );
  }

  const newest = backups[0];
  if (!newest) {
    throw new Error('Backup readiness failed: no verified backup is available');
  }

  const ageMs = current.getTime() - newest.createdAt.getTime();
  if (ageMs < 0) {
    throw new Error('Backup readiness failed: newest backup creation time is in the future');
  }
  if (ageMs > maximumAge * HOUR_MS) {
    throw new Error(
      `Backup readiness failed: newest verified backup is older than ${maximumAge} hour(s)`,
    );
  }

  return {
    directory: inspection.directory,
    total: backups.length,
    keepMinimum: minimum,
    maxAgeHours: maximumAge,
    newestCreatedAt: newest.createdAt.toISOString(),
    newestAgeHours: ageMs / HOUR_MS,
  };
}

export function buildBackupRetentionPlan({
  directory,
  signingKey,
  retentionDays,
  keepMinimum,
  now = new Date(),
}) {
  const days = positiveInteger(retentionDays, 'Backup retention days');
  const minimum = positiveInteger(keepMinimum, 'Backup minimum retained count');
  const inspection = inspectBackupDirectory({ directory, signingKey, now });
  const { backups, now: current } = inspection;

  const cutoff = current.getTime() - days * DAY_MS;
  const deletable = backups.filter(
    (backup, index) => index >= minimum && backup.createdAt.getTime() < cutoff,
  );

  return {
    directory: inspection.directory,
    retentionDays: days,
    keepMinimum: minimum,
    total: backups.length,
    retained: backups.length - deletable.length,
    deletable,
  };
}

export function executeBackupRetentionPlan(plan, confirmation) {
  if (confirmation !== 'PRUNE_KNOWME') {
    throw new Error('Backup pruning refused: pass --confirm PRUNE_KNOWME');
  }
  for (const backup of plan.deletable) {
    rmSync(backup.dumpPath);
    rmSync(backup.manifestPath);
  }
  return plan.deletable.length;
}

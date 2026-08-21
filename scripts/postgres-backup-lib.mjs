import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

export function requirePostgresUrl(value, label = 'DATABASE_URL') {
  if (!value || !String(value).trim()) {
    throw new Error(`${label} is required`);
  }

  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL`);
  }

  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`${label} must use postgres:// or postgresql://`);
  }

  if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
    throw new Error(`${label} must include a host and database name`);
  }

  return String(value);
}

export function requireDumpPath(value) {
  if (!value || !String(value).trim()) {
    throw new Error('A .dump file path is required');
  }

  const path = resolve(String(value));
  if (!path.endsWith('.dump')) {
    throw new Error('Backup files must use the .dump extension');
  }

  return path;
}

export function buildBackupArgs(databaseUrl, outputPath) {
  requirePostgresUrl(databaseUrl);
  const file = requireDumpPath(outputPath);
  return [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--compress=9',
    `--file=${file}`,
    databaseUrl,
  ];
}

export function buildRestoreArgs(databaseUrl, dumpPath) {
  requirePostgresUrl(databaseUrl, 'RESTORE_DATABASE_URL');
  const file = requireDumpPath(dumpPath);
  return [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--exit-on-error',
    `--dbname=${databaseUrl}`,
    file,
  ];
}

export function redactPostgresUrl(value) {
  const parsed = new URL(requirePostgresUrl(value));
  if (parsed.username) parsed.username = '***';
  if (parsed.password) parsed.password = '***';
  return parsed.toString();
}

export function sha256File(path) {
  const hash = createHash('sha256');
  hash.update(readFileSync(path));
  return hash.digest('hex');
}

export function manifestForBackup({ filePath, sha256, createdAt = new Date() }) {
  return {
    schemaVersion: 1,
    file: basename(filePath),
    sha256,
    createdAt: createdAt.toISOString(),
    format: 'postgresql-custom',
    containsSecrets: true,
  };
}

export function assertRestoreConfirmation(value) {
  if (value !== 'RESTORE_KNOWME') {
    throw new Error('Restore refused: pass --confirm RESTORE_KNOWME');
  }
}

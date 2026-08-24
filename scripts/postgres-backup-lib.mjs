import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const SHA256_RE = /^[a-f0-9]{64}$/i;
const MANIFEST_SIGNATURE_ALGORITHM = 'hmac-sha256';

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

  if (parsed.searchParams.has('sslpassword')) {
    throw new Error(`${label} must not embed sslpassword in the URL query string`);
  }

  return String(value);
}

function decodeUrlCredential(value, label) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`${label} contains invalid percent-encoding`);
  }
}

export function postgresCliConnection(value, label = 'DATABASE_URL') {
  const parsed = new URL(requirePostgresUrl(value, label));
  const env = {};

  if (parsed.username) {
    env.PGUSER = decodeUrlCredential(parsed.username, `${label} username`);
  }
  if (parsed.password) {
    env.PGPASSWORD = decodeUrlCredential(parsed.password, `${label} password`);
  }

  parsed.username = '';
  parsed.password = '';

  return {
    url: parsed.toString(),
    env,
  };
}

function postgresTargetIdentity(value, label) {
  const parsed = new URL(requirePostgresUrl(value, label));
  const port = parsed.port || '5432';
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  return `${parsed.hostname.toLowerCase()}:${port}/${database}`;
}

export function assertRestoreTargetIsolation(
  restoreDatabaseUrl,
  primaryDatabaseUrl,
  allowPrimaryRestore,
) {
  requirePostgresUrl(restoreDatabaseUrl, 'RESTORE_DATABASE_URL');
  if (!primaryDatabaseUrl || !String(primaryDatabaseUrl).trim()) return;

  const restoreTarget = postgresTargetIdentity(restoreDatabaseUrl, 'RESTORE_DATABASE_URL');
  const primaryTarget = postgresTargetIdentity(primaryDatabaseUrl, 'DATABASE_URL');
  if (restoreTarget !== primaryTarget) return;

  if (allowPrimaryRestore !== 'RESTORE_PRIMARY_KNOWME') {
    throw new Error(
      'Restore target matches DATABASE_URL; isolated restore refused. Pass --allow-primary-restore RESTORE_PRIMARY_KNOWME only for a deliberate primary-database recovery.',
    );
  }
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

export function backupManifestPath(dumpPath) {
  return `${requireDumpPath(dumpPath)}.manifest.json`;
}

export function assertBackupDestinationAvailable(dumpPath) {
  const dump = requireDumpPath(dumpPath);
  const manifest = backupManifestPath(dump);
  if (existsSync(dump) || existsSync(manifest)) {
    throw new Error('Backup destination already exists; choose a new output path');
  }
  return { dump, manifest };
}

export function cleanupBackupArtifacts(dumpPath) {
  const dump = requireDumpPath(dumpPath);
  const manifest = backupManifestPath(dump);
  rmSync(dump, { force: true });
  rmSync(manifest, { force: true });
}

export function buildBackupArgs(databaseUrl, outputPath) {
  const connection = postgresCliConnection(databaseUrl);
  const file = requireDumpPath(outputPath);
  return [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--compress=9',
    `--file=${file}`,
    connection.url,
  ];
}

export function buildRestoreArgs(databaseUrl, dumpPath) {
  const connection = postgresCliConnection(databaseUrl, 'RESTORE_DATABASE_URL');
  const file = requireDumpPath(dumpPath);
  return [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--exit-on-error',
    `--dbname=${connection.url}`,
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

export function requireBackupManifestSigningKey(value) {
  if (!value || typeof value !== 'string' || value.length < 32) {
    throw new Error('KNOWME_BACKUP_MANIFEST_SIGNING_KEY must contain at least 32 characters');
  }
  return value;
}

function manifestSignaturePayload(manifest) {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    file: manifest.file,
    sha256: manifest.sha256,
    createdAt: manifest.createdAt,
    format: manifest.format,
    containsSecrets: manifest.containsSecrets,
  });
}

function signManifestPayload(manifest, signingKey) {
  return createHmac('sha256', requireBackupManifestSigningKey(signingKey))
    .update(manifestSignaturePayload(manifest))
    .digest('hex');
}

export function manifestForBackup({ filePath, sha256, createdAt = new Date(), signingKey }) {
  const manifest = {
    schemaVersion: 2,
    file: basename(filePath),
    sha256,
    createdAt: createdAt.toISOString(),
    format: 'postgresql-custom',
    containsSecrets: true,
  };

  return {
    ...manifest,
    signature: {
      algorithm: MANIFEST_SIGNATURE_ALGORITHM,
      value: signManifestPayload(manifest, signingKey),
    },
  };
}

export function verifyBackupManifestAuthenticity(
  manifest,
  signingKey,
  { allowUnsignedLegacy = false } = {},
) {
  if (manifest?.schemaVersion === 1) {
    if (allowUnsignedLegacy === true) return manifest;
    throw new Error(
      'Unsigned legacy backup manifest refused; use the explicit legacy restore override only for a trusted historical backup',
    );
  }

  if (manifest?.schemaVersion !== 2) {
    throw new Error('Backup manifest does not match the supported signed schema');
  }
  if (
    !manifest.signature ||
    manifest.signature.algorithm !== MANIFEST_SIGNATURE_ALGORITHM ||
    typeof manifest.signature.value !== 'string' ||
    !SHA256_RE.test(manifest.signature.value)
  ) {
    throw new Error('Backup manifest signature is invalid');
  }

  const expected = Buffer.from(signManifestPayload(manifest, signingKey), 'hex');
  const actual = Buffer.from(manifest.signature.value, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Backup manifest authenticity check failed');
  }
  return manifest;
}

export function validateBackupManifest(
  manifest,
  dumpPath,
  { now = new Date(), maxAgeHours = null, maxFutureSkewMinutes = 5 } = {},
) {
  if (!manifest || ![1, 2].includes(manifest.schemaVersion)) {
    throw new Error('Backup manifest does not match the supported schema');
  }
  if (manifest.format !== 'postgresql-custom' || manifest.containsSecrets !== true) {
    throw new Error('Backup manifest does not describe a supported PostgreSQL custom dump');
  }
  if (manifest.file !== basename(requireDumpPath(dumpPath))) {
    throw new Error('Backup manifest file name does not match the selected dump');
  }
  if (typeof manifest.sha256 !== 'string' || !SHA256_RE.test(manifest.sha256)) {
    throw new Error('Backup manifest SHA-256 is invalid');
  }

  const createdAt = new Date(manifest.createdAt);
  if (!manifest.createdAt || Number.isNaN(createdAt.getTime())) {
    throw new Error('Backup manifest createdAt is invalid');
  }

  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(currentTime)) throw new Error('Restore clock is invalid');
  const futureLimit = currentTime + maxFutureSkewMinutes * 60_000;
  if (createdAt.getTime() > futureLimit) {
    throw new Error('Backup manifest createdAt is unexpectedly in the future');
  }

  if (maxAgeHours !== null) {
    const parsedMaxAgeHours = Number(maxAgeHours);
    if (!Number.isFinite(parsedMaxAgeHours) || parsedMaxAgeHours <= 0) {
      throw new Error('Restore maximum backup age must be a positive number of hours');
    }
    const ageMs = currentTime - createdAt.getTime();
    if (ageMs > parsedMaxAgeHours * 60 * 60_000) {
      throw new Error(`Backup is older than the allowed ${parsedMaxAgeHours} hour restore window`);
    }
  }

  return manifest;
}

export function assertRestoreConfirmation(value) {
  if (value !== 'RESTORE_KNOWME') {
    throw new Error('Restore refused: pass --confirm RESTORE_KNOWME');
  }
}

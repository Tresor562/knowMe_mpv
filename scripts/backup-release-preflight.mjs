#!/usr/bin/env node

const MIN_SIGNING_KEY_LENGTH = 32;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650;
const MIN_KEEP_MINIMUM = 1;
const MAX_KEEP_MINIMUM = 1000;
const OTHER_SECRET_KEYS = [
  'JWT_SECRET',
  'METRICS_BEARER_TOKEN',
  'MEDIA_S3_SECRET_ACCESS_KEY',
  'STICKER_TOKEN_ACTIVE_SECRET',
  'ACCOUNT_RECOVERY_SECRET',
  'ACCOUNT_RECOVERY_EMAIL_API_KEY',
  'CALL_TURN_SECRET',
  'NEXUS_KNOWME_SHARED_SECRET',
  'PAYMENTS_DATA_ENCRYPTION_KEY',
  'PAYMENTS_FRAUD_HASH_SALT',
];

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseRequiredBoundedInteger(env, key, min, max, errors) {
  const raw = env[key];
  if (!nonEmpty(raw)) {
    errors.push(`${key} must be explicitly configured for a market release.`);
    return null;
  }

  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    errors.push(`${key} must be an integer between ${min} and ${max}.`);
    return null;
  }

  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    errors.push(`${key} must be an integer between ${min} and ${max}.`);
    return null;
  }

  return value;
}

export function validateBackupReleaseEnvironment(env = process.env) {
  const errors = [];
  const key = env.KNOWME_BACKUP_MANIFEST_SIGNING_KEY;

  if (!nonEmpty(key) || key.length < MIN_SIGNING_KEY_LENGTH) {
    errors.push(
      `KNOWME_BACKUP_MANIFEST_SIGNING_KEY must be set to at least ${MIN_SIGNING_KEY_LENGTH} characters for a market release.`,
    );
  } else {
    for (const otherKey of OTHER_SECRET_KEYS) {
      if (!nonEmpty(env[otherKey])) continue;
      if (env[otherKey] === key) {
        errors.push(
          `KNOWME_BACKUP_MANIFEST_SIGNING_KEY must be distinct from ${otherKey}; backup authenticity requires a dedicated trust boundary.`,
        );
      }
    }
  }

  parseRequiredBoundedInteger(
    env,
    'KNOWME_BACKUP_RETENTION_DAYS',
    MIN_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
    errors,
  );
  parseRequiredBoundedInteger(
    env,
    'KNOWME_BACKUP_KEEP_MINIMUM',
    MIN_KEEP_MINIMUM,
    MAX_KEEP_MINIMUM,
    errors,
  );

  return { ok: errors.length === 0, errors };
}

function runCli() {
  const result = validateBackupReleaseEnvironment(process.env);
  if (!result.ok) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    console.error(`Backup release preflight failed with ${result.errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }
  console.log('Backup release preflight passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) runCli();

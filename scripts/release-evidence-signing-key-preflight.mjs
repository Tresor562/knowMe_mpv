#!/usr/bin/env node

const MIN_SIGNING_KEY_LENGTH = 32;

const OTHER_SECRET_KEYS = [
  'JWT_SECRET',
  'KNOWME_BACKUP_MANIFEST_SIGNING_KEY',
  'METRICS_BEARER_TOKEN',
  'MEDIA_S3_SECRET_ACCESS_KEY',
  'MEDIA_SCANNER_TOKEN',
  'MEDIA_PURGE_ALERT_WEBHOOK_TOKEN',
  'ACCOUNT_RECOVERY_SECRET',
  'ACCOUNT_RECOVERY_EMAIL_API_KEY',
  'CALL_TURN_SECRET',
  'NEXUS_KNOWME_SHARED_SECRET',
  'STICKER_TOKEN_ACTIVE_SECRET',
  'PAYMENTS_DATA_ENCRYPTION_KEY',
  'PAYMENTS_FRAUD_HASH_SALT',
  'FLUTTERWAVE_SECRET_KEY',
  'FLUTTERWAVE_WEBHOOK_SECRET',
  'CINETPAY_API_KEY',
  'CINETPAY_SECRET',
  'APPLE_PRIVATE_KEY',
];

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateReleaseEvidenceSigningKeyEnvironment(env = process.env) {
  const errors = [];
  const key = env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY;

  if (!nonEmpty(key) || key !== key.trim() || key.length < MIN_SIGNING_KEY_LENGTH) {
    errors.push(
      `KNOWME_RELEASE_EVIDENCE_SIGNING_KEY must be an explicit canonical secret of at least ${MIN_SIGNING_KEY_LENGTH} characters for market readiness.`,
    );
    return { ok: false, errors };
  }

  for (const otherKey of OTHER_SECRET_KEYS) {
    const otherValue = env[otherKey];
    if (!nonEmpty(otherValue)) continue;
    if (otherValue === key) {
      errors.push(
        `KNOWME_RELEASE_EVIDENCE_SIGNING_KEY must be distinct from ${otherKey}; release evidence authenticity requires a dedicated trust boundary.`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

function runCli() {
  const result = validateReleaseEvidenceSigningKeyEnvironment(process.env);
  if (!result.ok) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    console.error(`Release evidence signing-key preflight failed with ${result.errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }
  console.log('Release evidence signing-key preflight passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) runCli();

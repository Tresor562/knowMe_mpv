import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBackupReleaseEnvironment } from './backup-release-preflight.mjs';

function validEnv() {
  return {
    KNOWME_BACKUP_MANIFEST_SIGNING_KEY: 'backup-signing-key-0123456789abcdef-01',
    JWT_SECRET: 'j'.repeat(64),
    METRICS_BEARER_TOKEN: 'm'.repeat(64),
    MEDIA_S3_SECRET_ACCESS_KEY: 's'.repeat(64),
    STICKER_TOKEN_ACTIVE_SECRET: 't'.repeat(64),
    ACCOUNT_RECOVERY_SECRET: 'r'.repeat(64),
    ACCOUNT_RECOVERY_EMAIL_API_KEY: 'e'.repeat(64),
    CALL_TURN_SECRET: 'c'.repeat(64),
    NEXUS_KNOWME_SHARED_SECRET: 'n'.repeat(64),
    PAYMENTS_DATA_ENCRYPTION_KEY: 'p'.repeat(64),
    PAYMENTS_FRAUD_HASH_SALT: 'f'.repeat(64),
  };
}

test('accepts a dedicated backup manifest signing key', () => {
  const result = validateBackupReleaseEnvironment(validEnv());
  assert.deepEqual(result, { ok: true, errors: [] });
});

test('requires backup authenticity for a market release', () => {
  const missing = validEnv();
  delete missing.KNOWME_BACKUP_MANIFEST_SIGNING_KEY;
  let result = validateBackupReleaseEnvironment(missing);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('KNOWME_BACKUP_MANIFEST_SIGNING_KEY')));

  const short = validEnv();
  short.KNOWME_BACKUP_MANIFEST_SIGNING_KEY = 'too-short';
  result = validateBackupReleaseEnvironment(short);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('at least 32')));
});

test('rejects reuse of another production trust-boundary secret', () => {
  const env = validEnv();
  env.KNOWME_BACKUP_MANIFEST_SIGNING_KEY = env.JWT_SECRET;
  let result = validateBackupReleaseEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('JWT_SECRET')));

  env.KNOWME_BACKUP_MANIFEST_SIGNING_KEY = env.ACCOUNT_RECOVERY_SECRET;
  result = validateBackupReleaseEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('ACCOUNT_RECOVERY_SECRET')));
});

test('error messages never disclose the secret value', () => {
  const env = validEnv();
  const secret = env.JWT_SECRET;
  env.KNOWME_BACKUP_MANIFEST_SIGNING_KEY = secret;
  const result = validateBackupReleaseEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.every((error) => !error.includes(secret)));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBackupReleaseEnvironment } from './backup-release-preflight.mjs';

function validEnv() {
  return {
    KNOWME_BACKUP_MANIFEST_SIGNING_KEY: 'backup-signing-key-0123456789abcdef-01',
    KNOWME_BACKUP_RETENTION_DAYS: '30',
    KNOWME_BACKUP_KEEP_MINIMUM: '3',
    KNOWME_BACKUP_MAX_AGE_HOURS: '24',
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

test('accepts dedicated backup authenticity, retention and freshness policy', () => {
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

test('requires an explicit bounded retention window for market release', () => {
  const missing = validEnv();
  delete missing.KNOWME_BACKUP_RETENTION_DAYS;
  let result = validateBackupReleaseEnvironment(missing);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('KNOWME_BACKUP_RETENTION_DAYS')));

  for (const value of ['0', '3651', '30.5', '-1', 'not-a-number']) {
    const env = validEnv();
    env.KNOWME_BACKUP_RETENTION_DAYS = value;
    result = validateBackupReleaseEnvironment(env);
    assert.equal(result.ok, false, `expected retention ${value} to fail`);
    assert.ok(result.errors.some((error) => error.includes('KNOWME_BACKUP_RETENTION_DAYS')));
  }
});

test('requires an explicit bounded minimum backup count for market release', () => {
  const missing = validEnv();
  delete missing.KNOWME_BACKUP_KEEP_MINIMUM;
  let result = validateBackupReleaseEnvironment(missing);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('KNOWME_BACKUP_KEEP_MINIMUM')));

  for (const value of ['0', '1001', '3.5', '-1', 'none']) {
    const env = validEnv();
    env.KNOWME_BACKUP_KEEP_MINIMUM = value;
    result = validateBackupReleaseEnvironment(env);
    assert.equal(result.ok, false, `expected keep-minimum ${value} to fail`);
    assert.ok(result.errors.some((error) => error.includes('KNOWME_BACKUP_KEEP_MINIMUM')));
  }
});

test('requires an explicit bounded backup maximum age for market release', () => {
  const missing = validEnv();
  delete missing.KNOWME_BACKUP_MAX_AGE_HOURS;
  let result = validateBackupReleaseEnvironment(missing);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('KNOWME_BACKUP_MAX_AGE_HOURS')));

  for (const value of ['0', '8761', '24.5', '-1', 'later']) {
    const env = validEnv();
    env.KNOWME_BACKUP_MAX_AGE_HOURS = value;
    result = validateBackupReleaseEnvironment(env);
    assert.equal(result.ok, false, `expected max age ${value} to fail`);
    assert.ok(result.errors.some((error) => error.includes('KNOWME_BACKUP_MAX_AGE_HOURS')));
  }
});

test('accepts documented backup policy boundary values', () => {
  for (const [retentionDays, keepMinimum, maxAgeHours] of [
    ['1', '1', '1'],
    ['3650', '1000', '8760'],
  ]) {
    const env = validEnv();
    env.KNOWME_BACKUP_RETENTION_DAYS = retentionDays;
    env.KNOWME_BACKUP_KEEP_MINIMUM = keepMinimum;
    env.KNOWME_BACKUP_MAX_AGE_HOURS = maxAgeHours;
    assert.deepEqual(validateBackupReleaseEnvironment(env), { ok: true, errors: [] });
  }
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

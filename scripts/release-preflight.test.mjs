import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionEnvironment } from './release-preflight.mjs';

function validEnv() {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://knowme:secret@db.example.com:5432/knowme?schema=public',
    JWT_SECRET: 'j'.repeat(64),
    METRICS_BEARER_TOKEN: 'o'.repeat(64),
    NEXT_PUBLIC_API_URL: 'https://api.knowme.example',
    PUBLIC_PRIVACY_POLICY_URL: 'https://knowme.example/privacy',
    PUBLIC_TERMS_URL: 'https://knowme.example/terms',
    PUBLIC_ACCOUNT_DELETION_URL: 'https://knowme.example/account/data-rights',
    CORS_ALLOWED_ORIGINS_JSON: JSON.stringify(['https://knowme.example']),
    MEDIA_STORAGE_DRIVER: 's3',
    MEDIA_S3_ENDPOINT: 'https://objects.example.com',
    MEDIA_S3_BUCKET: 'knowme-private-media',
    MEDIA_S3_REGION: 'us-east-1',
    MEDIA_S3_ACCESS_KEY_ID: 'knowme-media-service',
    MEDIA_S3_SECRET_ACCESS_KEY: 'x'.repeat(64),
    MEDIA_S3_TIMEOUT_MS: '30000',
    MEDIA_S3_MAX_ATTEMPTS: '3',
    STICKER_TOKEN_ACTIVE_SECRET: 's'.repeat(64),
    ACCOUNT_RECOVERY_ENABLED: 'true',
    ACCOUNT_RECOVERY_SECRET: 'r'.repeat(64),
    ACCOUNT_RECOVERY_EMAIL_ENDPOINT: 'https://api.mail.example/v1/send',
    ACCOUNT_RECOVERY_EMAIL_API_KEY: 'm'.repeat(32),
    ACCOUNT_RECOVERY_EMAIL_FROM: 'KnowMe <security@knowme.example>',
    WEB_URL: 'https://knowme.example',
    CALL_REQUIRE_TURN_IN_PRODUCTION: 'true',
    CALL_TURN_SECRET: 't'.repeat(64),
    CALL_TURN_URLS_JSON: JSON.stringify(['turns:turn.example.com:5349?transport=tcp']),
    NEXUS_INTEGRATION_ENABLED: 'false',
    PAYMENTS_WEB_CATALOG_JSON: '[]',
    PAYMENTS_STORE_CATALOG_JSON: '[]',
  };
}

test('accepts a hardened production environment with monetization disabled', () => {
  const result = validateProductionEnvironment(validEnv());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
});

test('fails closed on local endpoints and weak secrets', () => {
  const env = validEnv();
  env.DATABASE_URL = 'postgresql://knowme:knowme@localhost:5432/knowme';
  env.JWT_SECRET = 'weak';
  env.METRICS_BEARER_TOKEN = 'short';
  env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
  env.STICKER_TOKEN_ACTIVE_SECRET = 'short';
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('DATABASE_URL')));
  assert.ok(result.errors.some((error) => error.includes('JWT_SECRET')));
  assert.ok(result.errors.some((error) => error.includes('METRICS_BEARER_TOKEN')));
  assert.ok(result.errors.some((error) => error.includes('NEXT_PUBLIC_API_URL')));
  assert.ok(result.errors.some((error) => error.includes('STICKER_TOKEN_ACTIVE_SECRET')));
});

test('requires public HTTPS privacy, terms and account-deletion resources for a market release', () => {
  const missing = validEnv();
  delete missing.PUBLIC_PRIVACY_POLICY_URL;
  delete missing.PUBLIC_TERMS_URL;
  delete missing.PUBLIC_ACCOUNT_DELETION_URL;
  let result = validateProductionEnvironment(missing);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('PUBLIC_PRIVACY_POLICY_URL')));
  assert.ok(result.errors.some((error) => error.includes('PUBLIC_TERMS_URL')));
  assert.ok(result.errors.some((error) => error.includes('PUBLIC_ACCOUNT_DELETION_URL')));

  const unsafe = validEnv();
  unsafe.PUBLIC_PRIVACY_POLICY_URL = 'http://knowme.example/privacy';
  unsafe.PUBLIC_TERMS_URL = 'https://localhost:3000/terms';
  unsafe.PUBLIC_ACCOUNT_DELETION_URL = 'not-a-url';
  result = validateProductionEnvironment(unsafe);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('PUBLIC_PRIVACY_POLICY_URL') && error.includes('HTTPS')));
  assert.ok(result.errors.some((error) => error.includes('PUBLIC_TERMS_URL') && error.includes('local host')));
  assert.ok(result.errors.some((error) => error.includes('PUBLIC_ACCOUNT_DELETION_URL') && error.includes('valid URL')));
});

test('requires metrics collection credentials for a market release', () => {
  const env = validEnv();
  delete env.METRICS_BEARER_TOKEN;
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('METRICS_BEARER_TOKEN')));
});

test('requires an exact HTTPS CORS allowlist for a market release', () => {
  const missing = validEnv();
  delete missing.CORS_ALLOWED_ORIGINS_JSON;
  let result = validateProductionEnvironment(missing);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('CORS_ALLOWED_ORIGINS_JSON')));

  const unsafe = validEnv();
  unsafe.CORS_ALLOWED_ORIGINS_JSON = JSON.stringify([
    '*',
    'http://knowme.example',
    'https://localhost:3000',
    'https://knowme.example/app?token=secret',
  ]);
  result = validateProductionEnvironment(unsafe);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('wildcard')));
  assert.ok(result.errors.some((error) => error.includes('HTTPS')));
  assert.ok(result.errors.some((error) => error.includes('local host')));
  assert.ok(result.errors.some((error) => error.includes('path, query, or fragment')));
});

test('requires private S3-compatible media storage for a market release', () => {
  const local = validEnv();
  local.MEDIA_STORAGE_DRIVER = 'local';
  let result = validateProductionEnvironment(local);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('MEDIA_STORAGE_DRIVER')));

  const unsafe = validEnv();
  unsafe.MEDIA_S3_ENDPOINT = 'http://localhost:9000';
  unsafe.MEDIA_S3_SECRET_ACCESS_KEY = 'short';
  result = validateProductionEnvironment(unsafe);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('MEDIA_S3_ENDPOINT')));
  assert.ok(result.errors.some((error) => error.includes('MEDIA_S3_SECRET_ACCESS_KEY')));
});

test('requires bounded private media timeout and retry settings', () => {
  const env = validEnv();
  env.MEDIA_S3_TIMEOUT_MS = '250';
  env.MEDIA_S3_MAX_ATTEMPTS = '10';
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('MEDIA_S3_TIMEOUT_MS')));
  assert.ok(result.errors.some((error) => error.includes('MEDIA_S3_MAX_ATTEMPTS')));
});

test('requires a distinct hardened account recovery secret and HTTPS delivery configuration', () => {
  const env = validEnv();
  env.ACCOUNT_RECOVERY_SECRET = env.JWT_SECRET;
  env.ACCOUNT_RECOVERY_EMAIL_ENDPOINT = 'http://localhost:3001/send';
  env.ACCOUNT_RECOVERY_EMAIL_API_KEY = 'short';
  env.ACCOUNT_RECOVERY_EMAIL_FROM = '';
  env.WEB_URL = 'http://localhost:3000';
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('ACCOUNT_RECOVERY_SECRET') && error.includes('JWT_SECRET')));
  assert.ok(result.errors.some((error) => error.includes('ACCOUNT_RECOVERY_EMAIL_ENDPOINT')));
  assert.ok(result.errors.some((error) => error.includes('ACCOUNT_RECOVERY_EMAIL_API_KEY')));
  assert.ok(result.errors.some((error) => error.includes('ACCOUNT_RECOVERY_EMAIL_FROM')));
  assert.ok(result.errors.some((error) => error.includes('WEB_URL')));
});

test('rejects reuse of production secrets across trust boundaries without leaking the secret value', () => {
  const env = validEnv();
  const reusedSecret = 'shared-secret-value-that-must-never-appear-in-errors-1234567890';
  env.JWT_SECRET = reusedSecret;
  env.METRICS_BEARER_TOKEN = reusedSecret;
  env.CALL_TURN_SECRET = reusedSecret;
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('METRICS_BEARER_TOKEN') && error.includes('JWT_SECRET')));
  assert.ok(result.errors.some((error) => error.includes('CALL_TURN_SECRET') && error.includes('JWT_SECRET')));
  assert.equal(result.errors.some((error) => error.includes(reusedSecret)), false);
});

test('checks optional integration secrets when those trust boundaries are configured', () => {
  const env = validEnv();
  env.NEXUS_INTEGRATION_ENABLED = 'true';
  env.NEXUS_SERVER_URL = 'https://nexus.example.com';
  env.NEXUS_KNOWME_SHARED_SECRET = env.STICKER_TOKEN_ACTIVE_SECRET;
  env.PAYMENTS_WEB_CATALOG_JSON = JSON.stringify([{ productKey: 'premium_monthly' }]);
  env.PAYMENTS_DATA_ENCRYPTION_KEY = 'p'.repeat(64);
  env.PAYMENTS_FRAUD_HASH_SALT = env.PAYMENTS_DATA_ENCRYPTION_KEY;
  env.PAYMENTS_PUBLIC_API_URL = 'https://payments.example.com';
  env.PAYMENTS_RETURN_URL = 'https://knowme.example/billing/return';
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('NEXUS_KNOWME_SHARED_SECRET') && error.includes('STICKER_TOKEN_ACTIVE_SECRET')));
  assert.ok(result.errors.some((error) => error.includes('PAYMENTS_FRAUD_HASH_SALT') && error.includes('PAYMENTS_DATA_ENCRYPTION_KEY')));
});

test('does not permit disabling account recovery for a market release', () => {
  const env = validEnv();
  env.ACCOUNT_RECOVERY_ENABLED = 'false';
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('ACCOUNT_RECOVERY_ENABLED')));
});

test('requires TURN when production calls require relaying', () => {
  const env = validEnv();
  env.CALL_TURN_SECRET = '';
  env.CALL_TURN_URLS_JSON = '[]';
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('CALL_TURN_SECRET')));
  assert.ok(result.errors.some((error) => error.includes('CALL_TURN_URLS_JSON')));
});

test('requires Nexus server security only when integration is enabled', () => {
  const env = validEnv();
  env.NEXUS_INTEGRATION_ENABLED = 'true';
  env.NEXUS_KNOWME_SHARED_SECRET = '';
  env.NEXUS_SERVER_URL = 'http://nexus.example.com';
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('NEXUS_KNOWME_SHARED_SECRET')));
  assert.ok(result.errors.some((error) => error.includes('NEXUS_SERVER_URL')));
});

test('requires payment security when a catalog is enabled', () => {
  const env = validEnv();
  env.PAYMENTS_WEB_CATALOG_JSON = JSON.stringify([{ productKey: 'premium_monthly' }]);
  env.PAYMENTS_DATA_ENCRYPTION_KEY = '';
  env.PAYMENTS_FRAUD_HASH_SALT = '';
  env.PAYMENTS_PUBLIC_API_URL = '';
  env.PAYMENTS_RETURN_URL = '';
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('PAYMENTS_DATA_ENCRYPTION_KEY')));
  assert.ok(result.errors.some((error) => error.includes('PAYMENTS_FRAUD_HASH_SALT')));
  assert.ok(result.errors.some((error) => error.includes('PAYMENTS_PUBLIC_API_URL')));
  assert.ok(result.errors.some((error) => error.includes('PAYMENTS_RETURN_URL')));
});

test('rejects malformed JSON instead of silently weakening checks', () => {
  const env = validEnv();
  env.CALL_TURN_URLS_JSON = '[invalid';
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('valid JSON')));
});

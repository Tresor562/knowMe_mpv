import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionEnvironment } from './release-preflight.mjs';

function validEnv() {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://knowme:secret@db.example.com:5432/knowme?schema=public',
    JWT_SECRET: 'j'.repeat(64),
    NEXT_PUBLIC_API_URL: 'https://api.knowme.example',
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
  env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
  env.STICKER_TOKEN_ACTIVE_SECRET = 'short';
  const result = validateProductionEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('DATABASE_URL')));
  assert.ok(result.errors.some((error) => error.includes('JWT_SECRET')));
  assert.ok(result.errors.some((error) => error.includes('NEXT_PUBLIC_API_URL')));
  assert.ok(result.errors.some((error) => error.includes('STICKER_TOKEN_ACTIVE_SECRET')));
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
  assert.ok(result.errors.some((error) => error.includes('distinct from JWT_SECRET')));
  assert.ok(result.errors.some((error) => error.includes('ACCOUNT_RECOVERY_EMAIL_ENDPOINT')));
  assert.ok(result.errors.some((error) => error.includes('ACCOUNT_RECOVERY_EMAIL_API_KEY')));
  assert.ok(result.errors.some((error) => error.includes('ACCOUNT_RECOVERY_EMAIL_FROM')));
  assert.ok(result.errors.some((error) => error.includes('WEB_URL')));
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

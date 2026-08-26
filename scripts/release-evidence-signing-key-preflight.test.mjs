import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReleaseEvidenceSigningKeyEnvironment } from './release-evidence-signing-key-preflight.mjs';

const key = 'release-evidence-dedicated-signing-key-0001';

function validate(overrides = {}) {
  return validateReleaseEvidenceSigningKeyEnvironment({
    KNOWME_RELEASE_EVIDENCE_SIGNING_KEY: key,
    ...overrides,
  });
}

test('accepts a dedicated canonical release evidence signing key', () => {
  assert.deepEqual(validate(), { ok: true, errors: [] });
});

test('rejects missing, weak, or whitespace-padded signing keys', () => {
  for (const candidate of [undefined, '', 'short', ` ${key}`, `${key} `]) {
    const result = validate({ KNOWME_RELEASE_EVIDENCE_SIGNING_KEY: candidate });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('KNOWME_RELEASE_EVIDENCE_SIGNING_KEY')));
  }
});

test('rejects reuse of another production trust secret', () => {
  for (const secretName of [
    'JWT_SECRET',
    'KNOWME_BACKUP_MANIFEST_SIGNING_KEY',
    'MEDIA_SCANNER_TOKEN',
    'MEDIA_PURGE_ALERT_WEBHOOK_TOKEN',
    'ACCOUNT_RECOVERY_SECRET',
    'CALL_TURN_SECRET',
    'NEXUS_KNOWME_SHARED_SECRET',
    'STICKER_TOKEN_ACTIVE_SECRET',
    'PAYMENTS_DATA_ENCRYPTION_KEY',
    'FLUTTERWAVE_WEBHOOK_SECRET',
    'CINETPAY_SECRET',
    'APPLE_PRIVATE_KEY',
  ]) {
    const result = validate({ [secretName]: key });
    assert.equal(result.ok, false, secretName);
    assert.ok(result.errors.some((error) => error.includes(secretName)), secretName);
  }
});

test('does not expose secret values in validation errors', () => {
  const result = validate({ JWT_SECRET: key });
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.includes(key)), false);
});

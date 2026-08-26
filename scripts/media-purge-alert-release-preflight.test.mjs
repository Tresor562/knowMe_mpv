import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMediaPurgeAlertReleaseEnv } from './media-purge-alert-release-preflight.mjs';

const baseEnv = {
  MEDIA_PURGE_ALERT_WEBHOOK_URL: 'https://alerts.example.test/knowme/media-retention',
  MEDIA_PURGE_ALERT_WEBHOOK_TOKEN: 'a'.repeat(32),
  MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS: '3000'
};

test('accepts a bounded dedicated HTTPS webhook configuration', () => {
  const result = validateMediaPurgeAlertReleaseEnv(baseEnv);
  assert.equal(result.endpoint, 'https://alerts.example.test/knowme/media-retention');
  assert.equal(result.timeoutMs, 3000);
});

test('requires every alert setting for a market release', () => {
  for (const key of Object.keys(baseEnv)) {
    const env = { ...baseEnv };
    delete env[key];
    assert.throws(() => validateMediaPurgeAlertReleaseEnv(env), /required|dedicated token/);
  }
});

test('rejects unsafe webhook URLs', () => {
  for (const value of [
    'http://alerts.example.test/hook',
    'https://user:pass@alerts.example.test/hook',
    'https://alerts.example.test/hook?token=secret',
    'https://alerts.example.test/hook#fragment',
    'not-a-url'
  ]) {
    assert.throws(() => validateMediaPurgeAlertReleaseEnv({ ...baseEnv, MEDIA_PURGE_ALERT_WEBHOOK_URL: value }));
  }
});

test('rejects weak, padded, reused, or non-dedicated webhook tokens', () => {
  assert.throws(() =>
    validateMediaPurgeAlertReleaseEnv({ ...baseEnv, MEDIA_PURGE_ALERT_WEBHOOK_TOKEN: 'short' })
  );
  assert.throws(() =>
    validateMediaPurgeAlertReleaseEnv({
      ...baseEnv,
      MEDIA_PURGE_ALERT_WEBHOOK_TOKEN: ` ${'a'.repeat(32)}`
    })
  );
  assert.throws(() =>
    validateMediaPurgeAlertReleaseEnv({
      ...baseEnv,
      JWT_SECRET: baseEnv.MEDIA_PURGE_ALERT_WEBHOOK_TOKEN
    }),
    /distinct from JWT_SECRET/
  );
  assert.throws(() =>
    validateMediaPurgeAlertReleaseEnv({
      ...baseEnv,
      MEDIA_SCANNER_TOKEN: baseEnv.MEDIA_PURGE_ALERT_WEBHOOK_TOKEN
    }),
    /distinct from MEDIA_SCANNER_TOKEN/
  );
});

test('accepts timeout bounds and rejects non-canonical or out-of-range values', () => {
  assert.equal(
    validateMediaPurgeAlertReleaseEnv({ ...baseEnv, MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS: '500' }).timeoutMs,
    500
  );
  assert.equal(
    validateMediaPurgeAlertReleaseEnv({ ...baseEnv, MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS: '10000' }).timeoutMs,
    10000
  );

  for (const value of ['499', '10001', '0500', '1.5', '-1', 'abc']) {
    assert.throws(() =>
      validateMediaPurgeAlertReleaseEnv({ ...baseEnv, MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS: value })
    );
  }
});

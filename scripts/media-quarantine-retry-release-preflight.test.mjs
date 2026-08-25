import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMediaQuarantineRetryReleasePolicy } from './media-quarantine-retry-release-preflight.mjs';

const valid = {
  MEDIA_QUARANTINE_RETRY_ENABLED: 'false',
  MEDIA_QUARANTINE_RETRY_INTERVAL_MS: '60000',
  MEDIA_QUARANTINE_RETRY_BATCH_SIZE: '10'
};

test('accepts explicit bounded retry release settings', () => {
  assert.deepEqual(validateMediaQuarantineRetryReleasePolicy(valid), {
    enabled: false,
    intervalMs: 60_000,
    batchSize: 10
  });
});

test('requires canonical explicit retry enablement', () => {
  for (const value of [undefined, '', 'TRUE', 'False', '1', 'yes']) {
    assert.throws(
      () => validateMediaQuarantineRetryReleasePolicy({ ...valid, MEDIA_QUARANTINE_RETRY_ENABLED: value }),
      /MEDIA_QUARANTINE_RETRY_ENABLED/
    );
  }
});

test('rejects missing and non-canonical intervals', () => {
  for (const value of [undefined, '', '01', '60000.0', '0', '-1', 'abc']) {
    assert.throws(
      () => validateMediaQuarantineRetryReleasePolicy({ ...valid, MEDIA_QUARANTINE_RETRY_INTERVAL_MS: value }),
      /MEDIA_QUARANTINE_RETRY_INTERVAL_MS/
    );
  }
});

test('enforces interval bounds exactly', () => {
  assert.equal(validateMediaQuarantineRetryReleasePolicy({ ...valid, MEDIA_QUARANTINE_RETRY_INTERVAL_MS: '60000' }).intervalMs, 60_000);
  assert.equal(validateMediaQuarantineRetryReleasePolicy({ ...valid, MEDIA_QUARANTINE_RETRY_INTERVAL_MS: '21600000' }).intervalMs, 21_600_000);
  assert.throws(() => validateMediaQuarantineRetryReleasePolicy({ ...valid, MEDIA_QUARANTINE_RETRY_INTERVAL_MS: '59999' }), /between/);
  assert.throws(() => validateMediaQuarantineRetryReleasePolicy({ ...valid, MEDIA_QUARANTINE_RETRY_INTERVAL_MS: '21600001' }), /between/);
});

test('requires canonical bounded batch size', () => {
  for (const value of [undefined, '', '01', '1.0', '0', '-1', '101', 'abc']) {
    assert.throws(
      () => validateMediaQuarantineRetryReleasePolicy({ ...valid, MEDIA_QUARANTINE_RETRY_BATCH_SIZE: value }),
      /MEDIA_QUARANTINE_RETRY_BATCH_SIZE/
    );
  }
  assert.equal(validateMediaQuarantineRetryReleasePolicy({ ...valid, MEDIA_QUARANTINE_RETRY_BATCH_SIZE: '1' }).batchSize, 1);
  assert.equal(validateMediaQuarantineRetryReleasePolicy({ ...valid, MEDIA_QUARANTINE_RETRY_BATCH_SIZE: '100' }).batchSize, 100);
});

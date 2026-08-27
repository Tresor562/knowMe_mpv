import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleaseReceiptFreshnessPolicy } from './release-receipt-freshness-preflight.mjs';

test('accepts an explicit canonical receipt freshness policy', () => {
  assert.deepEqual(validateReleaseReceiptFreshnessPolicy({ KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS: '24' }), {
    ok: true,
    errors: [],
  });
});

test('rejects missing receipt freshness policy', () => {
  const result = validateReleaseReceiptFreshnessPolicy({});
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must be explicitly configured/);
});

test('rejects non-canonical and out-of-range receipt freshness policies', () => {
  for (const value of ['', '0', '01', '1.5', '-1', '8761', 'abc']) {
    const result = validateReleaseReceiptFreshnessPolicy({ KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS: value });
    assert.equal(result.ok, false, value);
  }
});

test('accepts exact policy bounds', () => {
  assert.equal(validateReleaseReceiptFreshnessPolicy({ KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS: '1' }).ok, true);
  assert.equal(validateReleaseReceiptFreshnessPolicy({ KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS: '8760' }).ok, true);
});

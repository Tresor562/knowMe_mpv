import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMediaUploadReleasePolicy } from './media-upload-release-preflight.mjs';

test('accepts inclusive supported upload bounds', () => {
  assert.equal(validateMediaUploadReleasePolicy({ MEDIA_UPLOAD_MAX_BYTES: '1048576' }), 1048576);
  assert.equal(validateMediaUploadReleasePolicy({ MEDIA_UPLOAD_MAX_BYTES: '26214400' }), 26214400);
});

test('requires an explicit market-release upload budget', () => {
  assert.throws(() => validateMediaUploadReleasePolicy({}), /is required/);
});

test('rejects non-canonical and out-of-range values', () => {
  for (const value of ['0', '01', '1048575', '26214401', '1.5', '-1', 'abc']) {
    assert.throws(() => validateMediaUploadReleasePolicy({ MEDIA_UPLOAD_MAX_BYTES: value }));
  }
});

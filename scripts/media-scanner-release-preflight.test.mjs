import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMediaScannerReleasePolicy } from './media-scanner-release-preflight.mjs';

test('blocks a market release until a real production media scanner is integrated', () => {
  assert.throws(
    () => validateMediaScannerReleasePolicy(),
    /production media scanning is not yet backed by a validated external scanner/
  );
});

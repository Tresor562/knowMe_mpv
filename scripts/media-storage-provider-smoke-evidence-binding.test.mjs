import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createObjectStorageProviderMarketEvidenceItem } from './media-storage-provider-smoke-evidence-binding.mjs';

const OBSERVED_AT = '2026-09-01T12:00:00.000Z';
const VALID_UNTIL = '2026-09-08T12:00:00.000Z';
const NOW = new Date('2026-09-01T12:01:00.000Z');
const OPTIONS = {
  scope: 'WEB_V1',
  verifier: 'release-platform',
  evidenceRef: 'evidence://knowme/object-storage/provider-smoke',
  validUntil: VALID_UNTIL,
  now: NOW,
};

function artifact(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'knowme-object-storage-provider-smoke',
    status: 'PASSED',
    observedAt: OBSERVED_AT,
    endpointSha256: 'a'.repeat(64),
    bucketSha256: 'b'.repeat(64),
    region: 'eu-west-1',
    canaryBytes: 32,
    checks: {
      signedPut: true,
      anonymousReadDenied: true,
      signedReadMatched: true,
      signedDelete: true,
      postDeleteNotFound: true,
    },
    ...overrides,
  };
}

function bytes(value = artifact()) {
  return Buffer.from(`${JSON.stringify(value)}\n`, 'utf8');
}

test('binds a semantically valid object-storage smoke to VERIFIED market evidence', () => {
  const retained = bytes();
  const result = createObjectStorageProviderMarketEvidenceItem(retained, OPTIONS);
  assert.equal(result.ok, true);
  assert.deepEqual(result.item, {
    id: 'object_storage_provider_validation',
    status: 'VERIFIED',
    verifiedAt: OBSERVED_AT,
    validUntil: VALID_UNTIL,
    verifier: 'release-platform',
    evidenceRef: 'evidence://knowme/object-storage/provider-smoke',
    evidenceSha256: createHash('sha256').update(retained).digest('hex'),
  });
});

test('refuses to bind an object-storage artifact whose anonymous read is not denied', () => {
  const weakened = artifact({
    checks: {
      ...artifact().checks,
      anonymousReadDenied: false,
    },
  });
  const result = createObjectStorageProviderMarketEvidenceItem(bytes(weakened), OPTIONS);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /anonymousReadDenied/);
});

test('refuses malformed JSON rather than creating hash-only evidence', () => {
  const result = createObjectStorageProviderMarketEvidenceItem(Buffer.from('{'), OPTIONS);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /valid JSON/);
});

test('refuses a materially future object-storage observation', () => {
  const future = artifact({ observedAt: '2026-09-01T12:07:00.000Z' });
  const result = createObjectStorageProviderMarketEvidenceItem(bytes(future), OPTIONS);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must not be in the future/);
});

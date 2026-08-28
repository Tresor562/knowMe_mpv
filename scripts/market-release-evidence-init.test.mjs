import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarketReleaseEvidenceManifest } from './market-release-evidence-init.mjs';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';

const commit = 'a'.repeat(40);
const signingKeyId = 'release-evidence-2026-08';

test('creates an exact WEB_V1 pending manifest', () => {
  const result = createMarketReleaseEvidenceManifest({
    scope: 'WEB_V1',
    releaseCommit: commit,
    releaseVersion: '1.0.0-rc.1',
    signingKeyId,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.manifest, {
    schemaVersion: 4,
    scope: 'WEB_V1',
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion: '1.0.0-rc.1',
    signingKeyId,
    evidence: requiredEvidenceForScope('WEB_V1').map((id) => ({ id, status: 'PENDING' })),
    manifestHmacSha256: '0'.repeat(64),
  });
});

test('FULL contains exactly the canonical full-scope evidence slots', () => {
  const result = createMarketReleaseEvidenceManifest({
    scope: 'FULL',
    releaseCommit: commit,
    releaseVersion: '1.0.0',
    signingKeyId,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.manifest.evidence.map((item) => item.id),
    requiredEvidenceForScope('FULL'),
  );
  assert.ok(result.manifest.evidence.every((item) => item.status === 'PENDING'));
});

test('rejects an unknown scope', () => {
  const result = createMarketReleaseEvidenceManifest({
    scope: 'MOBILE',
    releaseCommit: commit,
    releaseVersion: '1.0.0',
    signingKeyId,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /scope must be WEB_V1 or FULL/);
});

test('rejects non-canonical commit and version inputs', () => {
  const result = createMarketReleaseEvidenceManifest({
    scope: 'WEB_V1',
    releaseCommit: 'A'.repeat(40),
    releaseVersion: 'v1.0.0',
    signingKeyId,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /releaseCommit/);
  assert.match(result.errors.join(' '), /releaseVersion/);
});

test('rejects build metadata and non-canonical signing key ids', () => {
  const result = createMarketReleaseEvidenceManifest({
    scope: 'WEB_V1',
    releaseCommit: commit,
    releaseVersion: '1.0.0+build.1',
    signingKeyId: 'Release Key',
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /releaseVersion/);
  assert.match(result.errors.join(' '), /signingKeyId/);
});

test('does not accept whitespace-normalized signing key ids', () => {
  const result = createMarketReleaseEvidenceManifest({
    scope: 'WEB_V1',
    releaseCommit: commit,
    releaseVersion: '1.0.0',
    signingKeyId: ` ${signingKeyId}`,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /signingKeyId/);
});

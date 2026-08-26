import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';

const now = new Date('2026-08-26T21:30:00.000Z');
const bytes = Buffer.from('external-proof-bytes\n', 'utf8');
const baseOptions = {
  id: 'backup_restore_drill',
  scope: 'WEB_V1',
  verifier: 'release-operator',
  evidenceRef: 'evidence://release/backup-restore-drill.json',
  verifiedAt: '2026-08-26T21:25:00.000Z',
  validUntil: '2026-09-02T21:25:00.000Z',
  now,
};

test('creates a bounded VERIFIED item from the exact artifact bytes', () => {
  const result = createMarketReleaseEvidenceItem(bytes, baseOptions);
  assert.equal(result.ok, true);
  assert.deepEqual(result.item, {
    id: 'backup_restore_drill',
    status: 'VERIFIED',
    verifiedAt: baseOptions.verifiedAt,
    validUntil: baseOptions.validUntil,
    verifier: baseOptions.verifier,
    evidenceRef: baseOptions.evidenceRef,
    evidenceSha256: createHash('sha256').update(bytes).digest('hex'),
  });
});

test('hashes exact bytes instead of normalized text', () => {
  const lf = createMarketReleaseEvidenceItem(Buffer.from('proof\n'), baseOptions);
  const crlf = createMarketReleaseEvidenceItem(Buffer.from('proof\r\n'), baseOptions);
  assert.equal(lf.ok, true);
  assert.equal(crlf.ok, true);
  assert.notEqual(lf.item.evidenceSha256, crlf.item.evidenceSha256);
});

test('enforces scope and rejects FULL-only evidence from WEB_V1', () => {
  const rejected = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    id: 'ios_physical_validation',
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.errors.join(' '), /required by the selected market release scope/);

  const accepted = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    id: 'ios_physical_validation',
    scope: 'FULL',
  });
  assert.equal(accepted.ok, true);
});

test('rejects unsafe or non-canonical verifier and evidence references', () => {
  const badVerifier = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    verifier: ' release-operator ',
  });
  assert.equal(badVerifier.ok, false);

  for (const evidenceRef of [
    'http://evidence.example/proof.json',
    'https://user:secret@evidence.example/proof.json',
    'https://evidence.example/proof.json?token=secret',
    'https://evidence.example/proof.json#fragment',
  ]) {
    const result = createMarketReleaseEvidenceItem(bytes, { ...baseOptions, evidenceRef });
    assert.equal(result.ok, false, evidenceRef);
  }
});

test('rejects future, expired, and non-canonical timestamps', () => {
  const future = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    verifiedAt: '2026-08-26T21:40:01.000Z',
  });
  assert.equal(future.ok, false);

  const expired = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    validUntil: '2026-08-26T21:29:59.000Z',
  });
  assert.equal(expired.ok, false);

  const nonCanonical = createMarketReleaseEvidenceItem(bytes, {
    ...baseOptions,
    verifiedAt: '2026-08-26T21:25:00Z',
  });
  assert.equal(nonCanonical.ok, false);
});

test('rejects unknown evidence ids and invalid artifact inputs', () => {
  const unknown = createMarketReleaseEvidenceItem(bytes, { ...baseOptions, id: 'made_up_proof' });
  assert.equal(unknown.ok, false);

  const invalidBytes = createMarketReleaseEvidenceItem('not-bytes', baseOptions);
  assert.equal(invalidBytes.ok, false);
  assert.match(invalidBytes.errors.join(' '), /artifactBytes/);
});

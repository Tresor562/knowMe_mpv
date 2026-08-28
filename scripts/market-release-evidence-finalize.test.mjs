import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  finalizeMarketReleaseEvidence,
  writeFinalizedMarketReleaseEvidence,
} from './market-release-evidence-finalize.mjs';
import { requiredEvidenceForScope, validateMarketReleaseEvidence } from './market-release-evidence-preflight.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const signingKeyId = 'release-key-1';
const signingKey = 'k'.repeat(48);
const now = new Date('2026-08-26T22:30:00.000Z');
const zero = '0'.repeat(64);
const artifactSha = 'b'.repeat(64);
const manualReleaseBoundIds = new Set(['ios_physical_validation', 'android_physical_validation', 'ios_store_submission', 'android_store_submission']);

function pending(id) {
  return { id, status: 'PENDING', verifiedAt: null, validUntil: null, verifier: null, evidenceRef: null, evidenceSha256: null };
}

function item(id) {
  const evidence = {
    id,
    status: 'VERIFIED',
    verifiedAt: '2026-08-26T22:25:00.000Z',
    validUntil: '2026-09-02T22:25:00.000Z',
    verifier: 'release-operator',
    evidenceRef: `evidence://release/${id}.json`,
    evidenceSha256: artifactSha,
  };
  return manualReleaseBoundIds.has(id) ? { ...evidence, releaseCommit: commit, releaseVersion: version } : evidence;
}

function manifest(scope = 'WEB_V1') {
  return {
    schemaVersion: 4,
    scope,
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion: version,
    signingKeyId,
    evidence: requiredEvidenceForScope(scope).map(pending),
    manifestHmacSha256: zero,
  };
}

function finalize(source = manifest(), items = requiredEvidenceForScope(source.scope).map(item), overrides = {}) {
  return finalizeMarketReleaseEvidence(source, items, {
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
    ...overrides,
  });
}

test('atomically applies, signs, revalidates, and hashes WEB_V1 evidence', () => {
  const source = manifest();
  const result = finalize(source);
  assert.equal(result.ok, true);
  assert.equal(source.evidence.every((entry) => entry.status === 'PENDING'), true);
  assert.notEqual(result.manifest.manifestHmacSha256, zero);
  assert.equal(result.manifest.evidence.every((entry) => entry.status === 'VERIFIED'), true);
  assert.equal(createHash('sha256').update(result.bytes).digest('hex'), result.sha256);
  const validation = validateMarketReleaseEvidence(result.manifest, {
    expectedCommit: commit,
    expectedReleaseVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
  });
  assert.equal(validation.ok, true);
});

test('reserves and writes signed manifest plus digest as a pair', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd271-'));
  try {
    const result = finalize();
    assert.equal(result.ok, true);
    const outputPath = join(dir, 'release-evidence.signed.json');
    const digestPath = join(dir, 'release-evidence.signed.sha256');
    await writeFinalizedMarketReleaseEvidence({ outputPath, digestPath, bytes: result.bytes, sha256: result.sha256 });
    assert.deepEqual(await readFile(outputPath), result.bytes);
    assert.equal(await readFile(digestPath, 'utf8'), `${result.sha256}  ${outputPath}\n`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fails before creating artifacts when supplied digest does not match exact manifest bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd280-'));
  try {
    const result = finalize();
    assert.equal(result.ok, true);
    const outputPath = join(dir, 'release-evidence.signed.json');
    const digestPath = join(dir, 'release-evidence.signed.sha256');
    await assert.rejects(writeFinalizedMarketReleaseEvidence({ outputPath, digestPath, bytes: result.bytes, sha256: 'c'.repeat(64) }), /does not match the exact bytes/);
    await assert.rejects(readFile(outputPath), /ENOENT/);
    await assert.rejects(readFile(digestPath), /ENOENT/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('rejects non-canonical bundle digests before creating artifacts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd280-'));
  try {
    const result = finalize();
    assert.equal(result.ok, true);
    const outputPath = join(dir, 'release-evidence.signed.json');
    const digestPath = join(dir, 'release-evidence.signed.sha256');
    await assert.rejects(writeFinalizedMarketReleaseEvidence({ outputPath, digestPath, bytes: result.bytes, sha256: result.sha256.toUpperCase() }), /canonical lowercase 64-character digest/);
    await assert.rejects(readFile(outputPath), /ENOENT/);
    await assert.rejects(readFile(digestPath), /ENOENT/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('does not leave a new manifest when digest reservation fails', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd271-'));
  try {
    const result = finalize();
    assert.equal(result.ok, true);
    const outputPath = join(dir, 'release-evidence.signed.json');
    const digestPath = join(dir, 'release-evidence.signed.sha256');
    await writeFile(digestPath, 'existing\n', 'utf8');
    await assert.rejects(writeFinalizedMarketReleaseEvidence({ outputPath, digestPath, bytes: result.bytes, sha256: result.sha256 }), /EEXIST/);
    await assert.rejects(readFile(outputPath), /ENOENT/);
    assert.equal(await readFile(digestPath, 'utf8'), 'existing\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fails before signing when one pending item is missing', () => {
  const result = finalize(manifest(), requiredEvidenceForScope('WEB_V1').slice(1).map(item));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /missing evidence items/);
});

test('fails closed on release commit mismatch', () => {
  const result = finalize(manifest(), undefined, { expectedCommit: 'c'.repeat(40) });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /releaseCommit does not match|commit/);
});

test('fails closed on release version mismatch', () => {
  const result = finalize(manifest(), undefined, { expectedVersion: '1.0.1' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /releaseVersion does not match|version/);
});

test('fails closed on signing key id mismatch', () => {
  const result = finalize(manifest(), undefined, { expectedSigningKeyId: 'release-key-2' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /signingKeyId does not match|signing key/);
});

test('fails closed with a weak signing key', () => {
  const result = finalize(manifest(), undefined, { signingKey: 'too-short' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /signing key must be at least/);
});

test('FULL finalize fails closed before signing without reviewed manual authorizations', () => {
  const source = manifest('FULL');
  const result = finalize(source, requiredEvidenceForScope('FULL').map(item));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /authorization minted by the reviewed promotion preflight/);
  assert.equal(source.evidence.every((entry) => entry.status === 'PENDING'), true);
});

test('FULL finalize rejects forged manual authorization maps', () => {
  const authorizations = new Map();
  for (const id of manualReleaseBoundIds) authorizations.set(id, { evidenceId: id, releaseCommit: commit, releaseVersion: version });
  const result = finalize(manifest('FULL'), requiredEvidenceForScope('FULL').map(item), { manualAuthorizations: authorizations });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /authorization minted by the reviewed promotion preflight/);
});

test('FULL finalize rejects legacy manual evidence without serialized release binding', () => {
  const source = manifest('FULL');
  const items = requiredEvidenceForScope('FULL').map(item);
  const manual = items.find((entry) => manualReleaseBoundIds.has(entry.id));
  delete manual.releaseCommit;
  delete manual.releaseVersion;
  const result = finalize(source, items);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /manual physical\/store evidence item|releaseCommit|releaseVersion/);
});

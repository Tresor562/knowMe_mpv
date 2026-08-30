import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { applyMarketReleaseEvidenceBatch } from './market-release-evidence-batch-apply.mjs';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const now = new Date('2026-08-26T22:30:00.000Z');
const zero = '0'.repeat(64);
const sha = 'b'.repeat(64);
const manualReleaseBoundIds = new Set([
  'ios_physical_validation',
  'android_physical_validation',
  'ios_store_submission',
  'android_store_submission',
]);

function pending(id) {
  return { id, status: 'PENDING', verifiedAt: null, validUntil: null, verifier: null, evidenceRef: null, evidenceSha256: null };
}
function item(id) {
  const evidence = { id, status: 'VERIFIED', verifiedAt: '2026-08-26T22:25:00.000Z', validUntil: '2026-09-02T22:25:00.000Z', verifier: 'release-operator', evidenceRef: `evidence://release/${id}.json`, evidenceSha256: sha };
  return manualReleaseBoundIds.has(id) ? { ...evidence, releaseCommit: commit, releaseVersion: version } : evidence;
}
function manifest(scope = 'WEB_V1') {
  return { schemaVersion: 4, scope, environment: 'PRODUCTION', releaseCommit: commit, releaseVersion: version, signingKeyId: 'release-key-1', evidence: requiredEvidenceForScope(scope).map(pending), manifestHmacSha256: zero };
}

test('atomically applies exactly all pending WEB_V1 evidence', () => {
  const source = manifest();
  const result = applyMarketReleaseEvidenceBatch(source, requiredEvidenceForScope('WEB_V1').map(item), { expectedCommit: commit, expectedVersion: version, now });
  assert.equal(result.ok, true);
  assert.equal(result.manifest.evidence.every((entry) => entry.status === 'VERIFIED'), true);
  assert.equal(source.evidence.every((entry) => entry.status === 'PENDING'), true);
  assert.equal(result.manifest.manifestHmacSha256, zero);
});

test('accepts an already verified slot only when no replacement item is supplied', () => {
  const source = manifest();
  source.evidence[0] = item(source.evidence[0].id);
  const remaining = source.evidence.slice(1).map((entry) => item(entry.id));
  const result = applyMarketReleaseEvidenceBatch(source, remaining, { expectedCommit: commit, expectedVersion: version, now });
  assert.equal(result.ok, true);
  assert.equal(result.manifest.evidence.every((entry) => entry.status === 'VERIFIED'), true);
});

test('fails closed if one pending evidence item is missing', () => {
  const items = requiredEvidenceForScope('WEB_V1').slice(1).map(item);
  const result = applyMarketReleaseEvidenceBatch(manifest(), items, { expectedCommit: commit, expectedVersion: version, now });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /missing evidence items/);
});

test('rejects duplicate and non-pending replacements', () => {
  const source = manifest();
  source.evidence[0] = item(source.evidence[0].id);
  const duplicate = item(source.evidence[0].id);
  const items = [duplicate, duplicate, ...source.evidence.slice(1).map((entry) => item(entry.id))];
  const result = applyMarketReleaseEvidenceBatch(source, items, { expectedCommit: commit, expectedVersion: version, now });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /duplicate evidence ids|non-PENDING/);
});

test('rejects malformed manifest slot sets before applying anything', () => {
  const source = manifest();
  source.evidence.push(pending('production_tls_domain'));
  const result = applyMarketReleaseEvidenceBatch(source, requiredEvidenceForScope('WEB_V1').map(item), { expectedCommit: commit, expectedVersion: version, now });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /exactly one evidence slot/);
});

test('rejects mutation of an already signed manifest', () => {
  const source = manifest();
  source.manifestHmacSha256 = 'c'.repeat(64);
  const result = applyMarketReleaseEvidenceBatch(source, requiredEvidenceForScope('WEB_V1').map(item), { expectedCommit: commit, expectedVersion: version, now });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must be unsigned/);
});

test('FULL batch fails closed when manual evidence has no reviewed process-local authorization', () => {
  const source = manifest('FULL');
  const result = applyMarketReleaseEvidenceBatch(source, requiredEvidenceForScope('FULL').map(item), { expectedCommit: commit, expectedVersion: version, now });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /authorization minted by the reviewed promotion preflight/);
  assert.equal(source.evidence.every((entry) => entry.status === 'PENDING'), true);
});

test('FULL batch rejects forged manual authorization maps', () => {
  const authorizations = new Map();
  for (const id of manualReleaseBoundIds) authorizations.set(id, { evidenceId: id, releaseCommit: commit, releaseVersion: version });
  const result = applyMarketReleaseEvidenceBatch(manifest('FULL'), requiredEvidenceForScope('FULL').map(item), {
    expectedCommit: commit,
    expectedVersion: version,
    now,
    manualAuthorizations: authorizations,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /authorization minted by the reviewed promotion preflight/);
});

test('FULL batch rejects legacy manual evidence before lower-level release-binding checks', () => {
  const source = manifest('FULL');
  const items = requiredEvidenceForScope('FULL').map(item);
  const manual = items.find((entry) => manualReleaseBoundIds.has(entry.id));
  delete manual.releaseCommit;
  delete manual.releaseVersion;
  const result = applyMarketReleaseEvidenceBatch(source, items, { expectedCommit: commit, expectedVersion: version, now });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /authorization minted by the reviewed promotion preflight/);
  assert.equal(source.evidence.every((entry) => entry.status === 'PENDING'), true);
});

async function writeCliItems(itemsDir) {
  await mkdir(itemsDir, { recursive: true });
  const clock = Date.now();
  for (const id of requiredEvidenceForScope('WEB_V1')) {
    const value = {
      id,
      status: 'VERIFIED',
      verifiedAt: new Date(clock - 60_000).toISOString(),
      validUntil: new Date(clock + 86_400_000).toISOString(),
      verifier: 'release-operator',
      evidenceRef: `evidence://release/${id}.json`,
      evidenceSha256: sha,
    };
    await writeFile(join(itemsDir, `${id}.json`), `${JSON.stringify(value)}\n`);
  }
}

function runBatchCli(manifestPath, itemsDir, outputPath) {
  return spawnSync(process.execPath, [
    new URL('./market-release-evidence-batch-apply.mjs', import.meta.url).pathname,
    '--manifest', manifestPath,
    '--items-dir', itemsDir,
    '--output', outputPath,
    '--commit', commit,
    '--version', version,
  ], { encoding: 'utf8' });
}

test('batch CLI accepts bounded regular manifest and evidence item files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd323-'));
  try {
    const manifestPath = join(dir, 'manifest.json');
    const itemsDir = join(dir, 'items');
    const outputPath = join(dir, 'output.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest())}\n`);
    await writeCliItems(itemsDir);

    const result = runBatchCli(manifestPath, itemsDir, outputPath);
    assert.equal(result.status, 0, result.stderr);
    const applied = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(applied.evidence.every((entry) => entry.status === 'VERIFIED'), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('batch CLI rejects a symlinked manifest before JSON ingestion', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd323-'));
  try {
    const realManifestPath = join(dir, 'real-manifest.json');
    const manifestPath = join(dir, 'manifest.json');
    const itemsDir = join(dir, 'items');
    const outputPath = join(dir, 'output.json');
    await writeFile(realManifestPath, `${JSON.stringify(manifest())}\n`);
    await symlink(realManifestPath, manifestPath);
    await writeCliItems(itemsDir);

    const result = runBatchCli(manifestPath, itemsDir, outputPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /release evidence manifest must be a regular non-symlink file/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('batch CLI rejects a symlinked evidence items directory before ingestion or output creation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd343-'));
  try {
    const manifestPath = join(dir, 'manifest.json');
    const realItemsDir = join(dir, 'items');
    const itemsDir = join(dir, 'items-link');
    const outputPath = join(dir, 'output.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest())}\n`);
    await writeCliItems(realItemsDir);
    await symlink(realItemsDir, itemsDir, 'dir');

    const result = runBatchCli(manifestPath, itemsDir, outputPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /items directory.*symlink|real directory/i);
    await assert.rejects(readFile(outputPath), /ENOENT/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

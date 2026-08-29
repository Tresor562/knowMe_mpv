import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';

function pending(id) {
  return { id, status: 'PENDING', verifiedAt: null, validUntil: null, verifier: null, evidenceRef: null, evidenceSha256: null };
}

function manifest() {
  return {
    schemaVersion: 4,
    scope: 'WEB_V1',
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion: version,
    signingKeyId: 'release-key-1',
    evidence: requiredEvidenceForScope('WEB_V1').map(pending),
    manifestHmacSha256: '0'.repeat(64),
  };
}

function evidenceItem(id) {
  const now = Date.now();
  return {
    id,
    status: 'VERIFIED',
    verifiedAt: new Date(now - 60_000).toISOString(),
    validUntil: new Date(now + 86_400_000).toISOString(),
    verifier: 'release-operator',
    evidenceRef: `evidence://release/${id}.json`,
    evidenceSha256: 'b'.repeat(64),
  };
}

async function writeItems(itemsDir) {
  await mkdir(itemsDir, { recursive: true });
  for (const id of requiredEvidenceForScope('WEB_V1')) {
    await writeFile(join(itemsDir, `${id}.json`), `${JSON.stringify(evidenceItem(id))}\n`);
  }
}

function runBatch(manifestPath, itemsDir, outputPath) {
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
    await writeItems(itemsDir);

    const result = runBatch(manifestPath, itemsDir, outputPath);
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
    await writeItems(itemsDir);

    const result = runBatch(manifestPath, itemsDir, outputPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /release evidence manifest must be a regular non-symlink file/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

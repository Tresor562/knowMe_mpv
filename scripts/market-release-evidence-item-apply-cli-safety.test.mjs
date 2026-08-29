import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const commonIds = [
  'production_tls_domain',
  'production_deployment_smoke',
  'backup_restore_drill',
  'external_monitoring_alerting',
  'privacy_terms_legal_review',
  'data_export_delete_validation',
  'moderation_support_incident_ops',
  'antimalware_provider_validation',
];

function pending(id) {
  return { id, status: 'PENDING', verifiedAt: null, validUntil: null, verifier: '', evidenceRef: '', evidenceSha256: '' };
}

function manifest() {
  return {
    schemaVersion: 4,
    scope: 'WEB_V1',
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion: version,
    signingKeyId: 'release-key-1',
    evidence: commonIds.map(pending),
    manifestHmacSha256: '0'.repeat(64),
  };
}

function item() {
  const now = Date.now();
  return {
    id: 'backup_restore_drill',
    status: 'VERIFIED',
    verifiedAt: new Date(now - 60_000).toISOString(),
    validUntil: new Date(now + 86_400_000).toISOString(),
    verifier: 'release-operator',
    evidenceRef: 'evidence://release/backup-restore-drill.json',
    evidenceSha256: 'b'.repeat(64),
  };
}

function runApply(manifestPath, itemPath, outputPath) {
  return spawnSync(process.execPath, [
    new URL('./market-release-evidence-item-apply.mjs', import.meta.url).pathname,
    '--manifest', manifestPath,
    '--item', itemPath,
    '--output', outputPath,
    '--commit', commit,
    '--version', version,
  ], { encoding: 'utf8' });
}

test('apply CLI accepts regular bounded manifest and item files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd322-'));
  try {
    const manifestPath = join(dir, 'manifest.json');
    const itemPath = join(dir, 'item.json');
    const outputPath = join(dir, 'output.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest())}\n`);
    await writeFile(itemPath, `${JSON.stringify(item())}\n`);

    const result = runApply(manifestPath, itemPath, outputPath);
    assert.equal(result.status, 0, result.stderr);
    const applied = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(applied.evidence.find((entry) => entry.id === 'backup_restore_drill').status, 'VERIFIED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('apply CLI rejects a symlinked evidence item before JSON ingestion', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd322-'));
  try {
    const manifestPath = join(dir, 'manifest.json');
    const realItemPath = join(dir, 'real-item.json');
    const itemPath = join(dir, 'item.json');
    const outputPath = join(dir, 'output.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest())}\n`);
    await writeFile(realItemPath, `${JSON.stringify(item())}\n`);
    await symlink(realItemPath, itemPath);

    const result = runApply(manifestPath, itemPath, outputPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /release evidence item must be a regular non-symlink file/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

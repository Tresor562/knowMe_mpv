import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRestoreDrillMarketEvidenceItem, validateRestoreDrillArtifact } from './postgres-restore-drill-evidence-binding.mjs';

const now = new Date('2026-08-27T12:00:00.000Z');
const cliPath = fileURLToPath(new URL('./postgres-restore-drill-evidence-binding.mjs', import.meta.url));

function artifact(overrides = {}) {
  return {
    schemaVersion: 3,
    kind: 'knowme-postgres-restore-drill',
    status: 'PASSED',
    observedAt: '2026-08-27T11:00:10.000Z',
    backup: { file: 'knowme.dump', sha256: 'a'.repeat(64), createdAt: '2026-08-27T10:00:00.000Z' },
    restore: {
      isolatedTarget: true,
      checks: {
        databaseReachable: true,
        prismaMigrationsTable: true,
        publicTableCount: 42,
        appliedMigrationCount: 18,
        unfinishedMigrationCount: 0,
      },
      recovery: {
        startedAt: '2026-08-27T11:00:00.000Z',
        completedAt: '2026-08-27T11:00:10.000Z',
        recoveryPointAgeSeconds: 3600,
        restoreDurationMs: 10000,
        policy: { maxRpoHours: 24, maxRtoSeconds: 900 },
      },
    },
    proofBoundary: 'bounded proof',
    ...overrides,
  };
}

function cliArgs(artifactPath, outputPath) {
  return [cliPath, '--artifact', artifactPath, '--output', outputPath, '--scope', 'WEB_V1', '--verifier', 'release-operator', '--ref', 'evidence://release/restore-drill-cli', '--valid-until', '2026-09-27T11:00:10.000Z'];
}

test('accepts a canonical passing restore drill artifact', () => {
  assert.deepEqual(validateRestoreDrillArtifact(artifact(), { now }), { ok: true, verifiedAt: '2026-08-27T11:00:10.000Z' });
});

test('creates backup_restore_drill item from exact artifact bytes', () => {
  const bytes = Buffer.from(`${JSON.stringify(artifact(), null, 2)}\n`);
  const result = createRestoreDrillMarketEvidenceItem(bytes, { scope: 'WEB_V1', verifier: 'release-operator', evidenceRef: 'evidence://release/restore-drill-2026-08-27', validUntil: '2026-09-27T11:00:10.000Z', now });
  assert.equal(result.ok, true);
  assert.equal(result.item.id, 'backup_restore_drill');
  assert.equal(result.item.status, 'VERIFIED');
  assert.match(result.item.evidenceSha256, /^[0-9a-f]{64}$/);
});

test('rejects legacy or incomplete migration-state evidence', () => {
  const cases = [
    artifact({ schemaVersion: 2 }),
    artifact({ restore: { ...artifact().restore, checks: { ...artifact().restore.checks, unfinishedMigrationCount: 1 } } }),
    artifact({ restore: { ...artifact().restore, checks: { ...artifact().restore.checks, appliedMigrationCount: 0 } } }),
    artifact({ restore: { ...artifact().restore, checks: { ...artifact().restore.checks, publicTableCount: 0 } } }),
  ];
  for (const value of cases) assert.equal(validateRestoreDrillArtifact(value, { now }).ok, false);
});

test('rejects semantic failures even when JSON is hashable', () => {
  const cases = [
    artifact({ status: 'FAILED' }),
    artifact({ restore: { ...artifact().restore, isolatedTarget: false } }),
    artifact({ restore: { ...artifact().restore, checks: { ...artifact().restore.checks, prismaMigrationsTable: false } } }),
    artifact({ restore: { ...artifact().restore, recovery: { ...artifact().restore.recovery, restoreDurationMs: 901000 } } }),
    artifact({ observedAt: '2026-08-27T11:00:11.000Z' }),
  ];
  for (const value of cases) {
    const result = createRestoreDrillMarketEvidenceItem(Buffer.from(JSON.stringify(value)), { scope: 'WEB_V1', verifier: 'release-operator', evidenceRef: 'evidence://release/restore-drill', validUntil: '2026-09-27T11:00:10.000Z', now });
    assert.equal(result.ok, false);
  }
});

test('rejects invalid JSON and future observation', () => {
  assert.equal(createRestoreDrillMarketEvidenceItem(Buffer.from('{'), { now }).ok, false);
  const future = artifact({ observedAt: '2026-08-27T12:10:00.000Z', restore: { ...artifact().restore, recovery: { ...artifact().restore.recovery, completedAt: '2026-08-27T12:10:00.000Z' } } });
  assert.equal(validateRestoreDrillArtifact(future, { now }).ok, false);
});

test('CLI creates restore evidence from a regular retained artifact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-restore-binding-'));
  try {
    const artifactPath = join(dir, 'restore-drill.json');
    const outputPath = join(dir, 'item.json');
    await writeFile(artifactPath, `${JSON.stringify(artifact(), null, 2)}\n`);
    const result = spawnSync(process.execPath, cliArgs(artifactPath, outputPath), { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const item = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(item.id, 'backup_restore_drill');
    assert.equal(item.status, 'VERIFIED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CLI rejects a symlinked restore retained artifact before JSON ingestion', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Symlink creation is not reliably available on Windows CI without elevated privileges.');
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), 'knowme-restore-binding-symlink-'));
  try {
    const targetPath = join(dir, 'restore-drill-target.json');
    const artifactPath = join(dir, 'restore-drill-link.json');
    const outputPath = join(dir, 'item.json');
    await writeFile(targetPath, `${JSON.stringify(artifact(), null, 2)}\n`);
    await symlink(targetPath, artifactPath);
    const result = spawnSync(process.execPath, cliArgs(artifactPath, outputPath), { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /regular non-symlink file/);
    assert.equal(existsSync(outputPath), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

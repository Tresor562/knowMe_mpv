import test from 'node:test';
import assert from 'node:assert/strict';
import { createRestoreDrillMarketEvidenceItem, validateRestoreDrillArtifact } from './postgres-restore-drill-evidence-binding.mjs';

const now = new Date('2026-08-27T12:00:00.000Z');

function artifact(overrides = {}) {
  return {
    schemaVersion: 2,
    kind: 'knowme-postgres-restore-drill',
    status: 'PASSED',
    observedAt: '2026-08-27T11:00:10.000Z',
    backup: { file: 'knowme.dump', sha256: 'a'.repeat(64), createdAt: '2026-08-27T10:00:00.000Z' },
    restore: {
      isolatedTarget: true,
      checks: { databaseReachable: true, prismaMigrationsTable: true, schemaHasTables: true },
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

test('accepts a canonical passing restore drill artifact', () => {
  const result = validateRestoreDrillArtifact(artifact(), { now });
  assert.deepEqual(result, { ok: true, verifiedAt: '2026-08-27T11:00:10.000Z' });
});

test('creates backup_restore_drill item from exact artifact bytes', () => {
  const bytes = Buffer.from(`${JSON.stringify(artifact(), null, 2)}\n`);
  const result = createRestoreDrillMarketEvidenceItem(bytes, {
    scope: 'WEB_V1',
    verifier: 'release-operator',
    evidenceRef: 'evidence://release/restore-drill-2026-08-27',
    validUntil: '2026-09-27T11:00:10.000Z',
    now,
  });
  assert.equal(result.ok, true);
  assert.equal(result.item.id, 'backup_restore_drill');
  assert.equal(result.item.status, 'VERIFIED');
  assert.equal(result.item.verifiedAt, '2026-08-27T11:00:10.000Z');
  assert.match(result.item.evidenceSha256, /^[0-9a-f]{64}$/);
});

test('rejects semantic failures even when JSON is hashable', () => {
  const cases = [
    artifact({ status: 'FAILED' }),
    artifact({ restore: { ...artifact().restore, isolatedTarget: false } }),
    artifact({ restore: { ...artifact().restore, checks: { databaseReachable: true, prismaMigrationsTable: false, schemaHasTables: true } } }),
    artifact({ restore: { ...artifact().restore, recovery: { ...artifact().restore.recovery, restoreDurationMs: 901000 } } }),
    artifact({ observedAt: '2026-08-27T11:00:11.000Z' }),
  ];
  for (const value of cases) {
    const result = createRestoreDrillMarketEvidenceItem(Buffer.from(JSON.stringify(value)), {
      scope: 'WEB_V1', verifier: 'release-operator', evidenceRef: 'evidence://release/restore-drill',
      validUntil: '2026-09-27T11:00:10.000Z', now,
    });
    assert.equal(result.ok, false);
  }
});

test('rejects invalid JSON and future observation', () => {
  assert.equal(createRestoreDrillMarketEvidenceItem(Buffer.from('{'), { now }).ok, false);
  const future = artifact({ observedAt: '2026-08-27T12:10:00.000Z', restore: { ...artifact().restore, recovery: { ...artifact().restore.recovery, completedAt: '2026-08-27T12:10:00.000Z' } } });
  assert.equal(validateRestoreDrillArtifact(future, { now }).ok, false);
});

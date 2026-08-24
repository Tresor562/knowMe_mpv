import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertBackupDestinationAvailable,
  assertRestoreConfirmation,
  assertRestoreTargetIsolation,
  backupManifestPath,
  buildBackupArgs,
  buildRestoreArgs,
  cleanupBackupArtifacts,
  manifestForBackup,
  redactPostgresUrl,
  requireDumpPath,
  requirePostgresUrl,
  validateBackupManifest,
} from './postgres-backup-lib.mjs';

const SIGNING_KEY = 'test-backup-manifest-signing-key-0001';

function signedManifest(overrides = {}) {
  return manifestForBackup({
    filePath: '/secure/knowme.dump',
    sha256: 'a'.repeat(64),
    createdAt: new Date('2026-08-24T00:00:00.000Z'),
    signingKey: SIGNING_KEY,
    ...overrides,
  });
}

test('requires a concrete PostgreSQL URL', () => {
  assert.throws(() => requirePostgresUrl(''), /required/);
  assert.throws(() => requirePostgresUrl('https://example.com/db'), /postgres/);
  assert.throws(() => requirePostgresUrl('postgresql://db.example.com'), /database name/);
  assert.equal(
    requirePostgresUrl('postgresql://user:secret@db.example.com/knowme'),
    'postgresql://user:secret@db.example.com/knowme',
  );
});

test('backup command uses custom format and strips ownership semantics', () => {
  const args = buildBackupArgs(
    'postgresql://user:secret@db.example.com/knowme',
    '/tmp/knowme.dump',
  );
  assert.ok(args.includes('--format=custom'));
  assert.ok(args.includes('--no-owner'));
  assert.ok(args.includes('--no-privileges'));
  assert.ok(args.includes('--compress=9'));
  assert.ok(args.includes('--file=/tmp/knowme.dump'));
});

test('backup destination refuses overwrite of dump or manifest', () => {
  const directory = mkdtempSync(join(tmpdir(), 'knowme-backup-'));
  const dump = join(directory, 'knowme.dump');
  const manifest = backupManifestPath(dump);

  try {
    assert.deepEqual(assertBackupDestinationAvailable(dump), { dump, manifest });

    writeFileSync(dump, 'existing');
    assert.throws(() => assertBackupDestinationAvailable(dump), /already exists/);
    rmSync(dump);

    writeFileSync(manifest, '{}');
    assert.throws(() => assertBackupDestinationAvailable(dump), /already exists/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('backup cleanup removes partial dump and orphan manifest idempotently', () => {
  const directory = mkdtempSync(join(tmpdir(), 'knowme-backup-cleanup-'));
  const dump = join(directory, 'knowme.dump');
  const manifest = backupManifestPath(dump);

  try {
    writeFileSync(dump, 'partial sensitive data');
    writeFileSync(manifest, '{"partial":true}');
    cleanupBackupArtifacts(dump);
    assert.doesNotThrow(() => assertBackupDestinationAvailable(dump));
    assert.doesNotThrow(() => cleanupBackupArtifacts(dump));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('restore is destructive-by-design but guarded and exit-on-error', () => {
  assert.throws(() => assertRestoreConfirmation('yes'), /RESTORE_KNOWME/);
  assert.doesNotThrow(() => assertRestoreConfirmation('RESTORE_KNOWME'));

  const args = buildRestoreArgs(
    'postgresql://restore:secret@db.example.com/knowme_restore',
    '/tmp/knowme.dump',
  );
  assert.ok(args.includes('--clean'));
  assert.ok(args.includes('--if-exists'));
  assert.ok(args.includes('--exit-on-error'));
  assert.ok(args.includes('--no-owner'));
  assert.ok(args.includes('--no-privileges'));
});

test('restore target isolation refuses the configured primary database by default', () => {
  assert.doesNotThrow(() =>
    assertRestoreTargetIsolation(
      'postgresql://restore:secret@restore.example.com/knowme_restore',
      'postgresql://app:secret@db.example.com/knowme',
    ),
  );
  assert.throws(
    () =>
      assertRestoreTargetIsolation(
        'postgresql://restore:other@DB.EXAMPLE.COM:5432/knowme?sslmode=require',
        'postgres://app:secret@db.example.com/knowme',
      ),
    /matches DATABASE_URL/,
  );
  assert.doesNotThrow(() =>
    assertRestoreTargetIsolation(
      'postgresql://restore:other@db.example.com/knowme',
      'postgresql://app:secret@db.example.com:5432/knowme',
      'RESTORE_PRIMARY_KNOWME',
    ),
  );
  assert.throws(
    () =>
      assertRestoreTargetIsolation(
        'postgresql://restore:other@db.example.com/knowme',
        'postgresql://app:secret@db.example.com/knowme',
        'yes',
      ),
    /RESTORE_PRIMARY_KNOWME/,
  );
});

test('dump paths must use the custom-format extension', () => {
  assert.throws(() => requireDumpPath('/tmp/backup.sql'), /.dump/);
  assert.match(requireDumpPath('/tmp/backup.dump'), /backup\.dump$/);
});

test('database credentials are never exposed by redaction helper', () => {
  const redacted = redactPostgresUrl('postgresql://alice:super-secret@db.example.com/knowme');
  assert.ok(!redacted.includes('super-secret'));
  assert.ok(!redacted.includes('alice'));
  assert.ok(redacted.includes('db.example.com'));
});

test('backup manifests contain signed integrity metadata but no database URL', () => {
  const manifest = signedManifest({
    sha256: 'b'.repeat(64),
    createdAt: new Date('2026-08-21T20:00:00.000Z'),
  });

  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.file, 'knowme.dump');
  assert.equal(manifest.sha256, 'b'.repeat(64));
  assert.equal(manifest.createdAt, '2026-08-21T20:00:00.000Z');
  assert.equal(manifest.format, 'postgresql-custom');
  assert.equal(manifest.containsSecrets, true);
  assert.equal(manifest.signature.algorithm, 'hmac-sha256');
  assert.match(manifest.signature.value, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(manifest).includes('postgresql://'));
  assert.ok(!JSON.stringify(manifest).includes(SIGNING_KEY));
});

test('restore manifest validation binds metadata to the selected dump', () => {
  const manifest = signedManifest({ sha256: 'c'.repeat(64) });

  assert.equal(
    validateBackupManifest(manifest, '/restore/knowme.dump', {
      now: new Date('2026-08-24T01:00:00.000Z'),
    }),
    manifest,
  );
  assert.throws(
    () => validateBackupManifest({ ...manifest, file: 'other.dump' }, '/restore/knowme.dump'),
    /file name/,
  );
  assert.throws(
    () => validateBackupManifest({ ...manifest, sha256: 'not-a-sha' }, '/restore/knowme.dump'),
    /SHA-256/,
  );
});

test('restore manifest validation rejects unsupported or invalid metadata', () => {
  const manifest = signedManifest({ sha256: 'd'.repeat(64) });

  assert.throws(
    () => validateBackupManifest({ ...manifest, schemaVersion: 3 }, '/restore/knowme.dump'),
    /supported schema/,
  );
  assert.throws(
    () => validateBackupManifest({ ...manifest, format: 'plain' }, '/restore/knowme.dump'),
    /custom dump/,
  );
  assert.throws(
    () => validateBackupManifest({ ...manifest, createdAt: 'invalid' }, '/restore/knowme.dump'),
    /createdAt/,
  );
});

test('restore manifest validation can enforce freshness without pretending external backup proof', () => {
  const manifest = signedManifest({
    sha256: 'e'.repeat(64),
    createdAt: new Date('2026-08-23T00:00:00.000Z'),
  });

  assert.doesNotThrow(() =>
    validateBackupManifest(manifest, '/restore/knowme.dump', {
      now: new Date('2026-08-24T00:00:00.000Z'),
      maxAgeHours: 24,
    }),
  );
  assert.throws(
    () =>
      validateBackupManifest(manifest, '/restore/knowme.dump', {
        now: new Date('2026-08-24T01:00:00.000Z'),
        maxAgeHours: 24,
      }),
    /older than the allowed 24 hour/,
  );
  assert.throws(
    () =>
      validateBackupManifest(
        { ...manifest, createdAt: '2026-08-24T00:10:01.000Z' },
        '/restore/knowme.dump',
        { now: new Date('2026-08-24T00:00:00.000Z'), maxFutureSkewMinutes: 10 },
      ),
    /future/,
  );
});

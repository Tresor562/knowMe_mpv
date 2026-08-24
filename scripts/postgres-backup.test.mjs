import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertRestoreConfirmation,
  assertRestoreTargetIsolation,
  buildBackupArgs,
  buildRestoreArgs,
  manifestForBackup,
  redactPostgresUrl,
  requireDumpPath,
  requirePostgresUrl,
  validateBackupManifest,
} from './postgres-backup-lib.mjs';

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

test('backup manifests contain integrity metadata but no database URL', () => {
  const manifest = manifestForBackup({
    filePath: '/secure/knowme.dump',
    sha256: 'a'.repeat(64),
    createdAt: new Date('2026-08-21T20:00:00.000Z'),
  });

  assert.deepEqual(manifest, {
    schemaVersion: 1,
    file: 'knowme.dump',
    sha256: 'a'.repeat(64),
    createdAt: '2026-08-21T20:00:00.000Z',
    format: 'postgresql-custom',
    containsSecrets: true,
  });
  assert.ok(!JSON.stringify(manifest).includes('postgresql://'));
});

test('restore manifest validation binds metadata to the selected dump', () => {
  const manifest = manifestForBackup({
    filePath: '/secure/knowme.dump',
    sha256: 'b'.repeat(64),
    createdAt: new Date('2026-08-24T00:00:00.000Z'),
  });

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
  const manifest = manifestForBackup({
    filePath: '/secure/knowme.dump',
    sha256: 'c'.repeat(64),
    createdAt: new Date('2026-08-24T00:00:00.000Z'),
  });

  assert.throws(
    () => validateBackupManifest({ ...manifest, schemaVersion: 2 }, '/restore/knowme.dump'),
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
  const manifest = manifestForBackup({
    filePath: '/secure/knowme.dump',
    sha256: 'd'.repeat(64),
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

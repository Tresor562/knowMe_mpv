import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertRestoreConfirmation,
  buildBackupArgs,
  buildRestoreArgs,
  manifestForBackup,
  redactPostgresUrl,
  requireDumpPath,
  requirePostgresUrl,
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

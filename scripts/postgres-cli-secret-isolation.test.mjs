import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBackupArgs,
  buildRestoreArgs,
  postgresCliConnection,
  requirePostgresUrl,
} from './postgres-backup-lib.mjs';

const credentialedUrl =
  'postgresql://alice:p%40ss%3Aword@db.example.com:5432/knowme?sslmode=require';

test('PostgreSQL CLI connection moves URL credentials into libpq environment variables', () => {
  const connection = postgresCliConnection(credentialedUrl);

  assert.equal(connection.env.PGUSER, 'alice');
  assert.equal(connection.env.PGPASSWORD, 'p@ss:word');
  assert.equal(
    connection.url,
    'postgresql://db.example.com:5432/knowme?sslmode=require',
  );
  assert.ok(!connection.url.includes('alice'));
  assert.ok(!connection.url.includes('p%40ss'));
});

test('backup argv contains no database username or password', () => {
  const args = buildBackupArgs(credentialedUrl, '/tmp/knowme.dump');
  const argv = args.join(' ');

  assert.ok(!argv.includes('alice'));
  assert.ok(!argv.includes('p%40ss'));
  assert.ok(!argv.includes('p@ss'));
  assert.ok(argv.includes('db.example.com'));
  assert.ok(argv.includes('sslmode=require'));
});

test('restore argv contains no database username or password', () => {
  const args = buildRestoreArgs(
    'postgresql://restore:r%24ecret@restore.example.com/knowme_restore?sslmode=require',
    '/tmp/knowme.dump',
  );
  const argv = args.join(' ');

  assert.ok(!argv.includes('restore:r'));
  assert.ok(!argv.includes('r%24ecret'));
  assert.ok(!argv.includes('r$ecret'));
  assert.ok(argv.includes('restore.example.com'));
});

test('sslpassword query credentials are rejected instead of leaking through argv', () => {
  assert.throws(
    () => requirePostgresUrl('postgresql://db.example.com/knowme?sslpassword=secret'),
    /sslpassword/,
  );
});

test('URLs without embedded credentials preserve libpq environment fallback behavior', () => {
  const connection = postgresCliConnection(
    'postgresql://db.example.com/knowme?sslmode=verify-full',
  );

  assert.deepEqual(connection.env, {});
  assert.equal(
    connection.url,
    'postgresql://db.example.com/knowme?sslmode=verify-full',
  );
});

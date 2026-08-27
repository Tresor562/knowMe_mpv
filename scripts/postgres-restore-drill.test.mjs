import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { manifestForBackup } from './postgres-backup-lib.mjs';
import {
  assertRestoreDrillConfirmation,
  parseRestoreDrillCheckOutput,
  resolveRestoreDrillMaxAgeHours,
  runPostgresRestoreDrill,
} from './postgres-restore-drill.mjs';

const signingKey = 'restore-drill-signing-key-000000000001';
const now = new Date('2026-08-27T10:00:00.000Z');

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-restore-drill-'));
  const dump = join(dir, 'knowme.dump');
  const output = join(dir, 'restore-drill.json');
  const bytes = Buffer.from('custom-dump-fixture');
  await writeFile(dump, bytes);
  const { createHash } = await import('node:crypto');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const manifest = manifestForBackup({
    filePath: dump,
    sha256,
    createdAt: new Date('2026-08-27T08:00:00.000Z'),
    signingKey,
  });
  await writeFile(`${dump}.manifest.json`, `${JSON.stringify(manifest)}\n`);
  return { dir, dump, output };
}

test('restore drill policy requires canonical bounded hours and explicit confirmation', () => {
  assert.equal(resolveRestoreDrillMaxAgeHours('24'), 24);
  for (const invalid of ['0', '01', '1.5', '-1', '8761', 'text']) {
    assert.throws(() => resolveRestoreDrillMaxAgeHours(invalid));
  }
  assert.throws(() => assertRestoreDrillConfirmation('RESTORE_KNOWME'), /RESTORE_DRILL_KNOWME/);
  assert.doesNotThrow(() => assertRestoreDrillConfirmation('RESTORE_DRILL_KNOWME'));
});

test('restore drill integrity output must prove migrations and at least one public table', () => {
  assert.deepEqual(
    parseRestoreDrillCheckOutput('{"databaseReachable":true,"prismaMigrationsTable":true,"publicTableCount":42}'),
    { databaseReachable: true, prismaMigrationsTable: true, publicTableCount: 42 },
  );
  assert.throws(() => parseRestoreDrillCheckOutput('not-json'), /invalid JSON/);
  assert.throws(
    () => parseRestoreDrillCheckOutput('{"databaseReachable":true,"prismaMigrationsTable":false,"publicTableCount":42}'),
    /usable restored schema/,
  );
  assert.throws(
    () => parseRestoreDrillCheckOutput('{"databaseReachable":true,"prismaMigrationsTable":true,"publicTableCount":0}'),
    /usable restored schema/,
  );
});

test('restore drill uses an isolated target, keeps credentials out of psql argv, and writes bounded evidence', async () => {
  const f = await fixture();
  const calls = [];
  try {
    const spawn = (command, args, options) => {
      calls.push({ command, args, options });
      if (command === process.execPath) return { status: 0, stdout: 'restore ok', stderr: '' };
      if (command === 'psql') {
        return {
          status: 0,
          stdout: '{"databaseReachable":true,"prismaMigrationsTable":true,"publicTableCount":12}\n',
          stderr: '',
        };
      }
      throw new Error(`unexpected command ${command}`);
    };

    const result = await runPostgresRestoreDrill({
      dumpPath: f.dump,
      outputPath: f.output,
      maxAgeHours: '24',
      confirmation: 'RESTORE_DRILL_KNOWME',
      now,
      spawn,
      env: {
        DATABASE_URL: 'postgresql://app:primary-secret@db.example.com/knowme',
        RESTORE_DATABASE_URL: 'postgresql://restore:restore-secret@restore.example.com/knowme_restore?sslmode=require',
        KNOWME_BACKUP_MANIFEST_SIGNING_KEY: signingKey,
      },
    });

    assert.equal(calls.length, 2);
    assert.equal(calls[0].command, process.execPath);
    assert.ok(calls[0].args.includes('RESTORE_KNOWME'));
    assert.equal(calls[1].command, 'psql');
    assert.ok(!calls[1].args.join(' ').includes('restore-secret'));
    assert.equal(calls[1].options.env.PGPASSWORD, 'restore-secret');
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
    assert.equal(result.evidence.status, 'PASSED');
    assert.equal(result.evidence.restore.isolatedTarget, true);
    assert.equal(result.evidence.restore.checks.publicTableCount, 12);
    const persisted = JSON.parse(await readFile(f.output, 'utf8'));
    assert.equal(persisted.backup.file, 'knowme.dump');
    assert.ok(!JSON.stringify(persisted).includes('restore-secret'));
    assert.ok(!JSON.stringify(persisted).includes('primary-secret'));
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});

test('restore drill refuses the primary database before spawning destructive commands', async () => {
  const f = await fixture();
  let calls = 0;
  try {
    await assert.rejects(
      runPostgresRestoreDrill({
        dumpPath: f.dump,
        outputPath: f.output,
        maxAgeHours: '24',
        confirmation: 'RESTORE_DRILL_KNOWME',
        now,
        spawn: () => {
          calls += 1;
          return { status: 0 };
        },
        env: {
          DATABASE_URL: 'postgresql://app:a@db.example.com/knowme',
          RESTORE_DATABASE_URL: 'postgresql://restore:b@DB.EXAMPLE.COM:5432/knowme?sslmode=require',
          KNOWME_BACKUP_MANIFEST_SIGNING_KEY: signingKey,
        },
      }),
      /matches DATABASE_URL/,
    );
    assert.equal(calls, 0);
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});

test('restore drill reserves evidence output before restore and never overwrites an existing artifact', async () => {
  const f = await fixture();
  await writeFile(f.output, 'existing-evidence');
  let calls = 0;
  try {
    await assert.rejects(
      runPostgresRestoreDrill({
        dumpPath: f.dump,
        outputPath: f.output,
        maxAgeHours: '24',
        confirmation: 'RESTORE_DRILL_KNOWME',
        now,
        spawn: () => {
          calls += 1;
          return { status: 0 };
        },
        env: {
          DATABASE_URL: 'postgresql://app:a@db.example.com/knowme',
          RESTORE_DATABASE_URL: 'postgresql://restore:b@restore.example.com/knowme_restore',
          KNOWME_BACKUP_MANIFEST_SIGNING_KEY: signingKey,
        },
      }),
      /EEXIST/,
    );
    assert.equal(calls, 0);
    assert.equal(await readFile(f.output, 'utf8'), 'existing-evidence');
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});

test('restore drill removes its reserved evidence file when restore or integrity checks fail', async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      runPostgresRestoreDrill({
        dumpPath: f.dump,
        outputPath: f.output,
        maxAgeHours: '24',
        confirmation: 'RESTORE_DRILL_KNOWME',
        now,
        spawn: (command) =>
          command === process.execPath
            ? { status: 0, stdout: '', stderr: '' }
            : { status: 1, stdout: '', stderr: 'check failed' },
        env: {
          DATABASE_URL: 'postgresql://app:a@db.example.com/knowme',
          RESTORE_DATABASE_URL: 'postgresql://restore:b@restore.example.com/knowme_restore',
          KNOWME_BACKUP_MANIFEST_SIGNING_KEY: signingKey,
        },
      }),
      /integrity phase failed/,
    );
    await assert.rejects(readFile(f.output), /ENOENT/);
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});

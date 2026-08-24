import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { manifestForBackup, sha256File } from './postgres-backup-lib.mjs';
import {
  buildBackupRetentionPlan,
  executeBackupRetentionPlan,
} from './postgres-backup-retention-lib.mjs';

const SIGNING_KEY = 'retention-signing-key-0123456789abcdef';
const NOW = new Date('2026-08-24T07:00:00.000Z');

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'knowme-backup-retention-'));
  return {
    directory,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

function addBackup(directory, name, ageDays) {
  const dumpPath = join(directory, `${name}.dump`);
  writeFileSync(dumpPath, `backup:${name}`);
  const createdAt = new Date(NOW.getTime() - ageDays * 24 * 60 * 60 * 1000);
  const manifest = manifestForBackup({
    filePath: dumpPath,
    sha256: sha256File(dumpPath),
    createdAt,
    signingKey: SIGNING_KEY,
  });
  writeFileSync(`${dumpPath}.manifest.json`, `${JSON.stringify(manifest)}\n`);
  return dumpPath;
}

test('plans deletion only for backups older than retention while preserving the newest minimum', () => {
  const fx = fixture();
  try {
    addBackup(fx.directory, 'newest', 1);
    addBackup(fx.directory, 'recent', 5);
    addBackup(fx.directory, 'third', 10);
    addBackup(fx.directory, 'old', 35);
    addBackup(fx.directory, 'oldest', 40);

    const plan = buildBackupRetentionPlan({
      directory: fx.directory,
      signingKey: SIGNING_KEY,
      retentionDays: 30,
      keepMinimum: 3,
      now: NOW,
    });

    assert.equal(plan.total, 5);
    assert.equal(plan.retained, 3);
    assert.deepEqual(
      plan.deletable.map((entry) => entry.file),
      ['old.dump', 'oldest.dump'],
    );
  } finally {
    fx.cleanup();
  }
});

test('never prunes below the configured minimum even when every backup is old', () => {
  const fx = fixture();
  try {
    addBackup(fx.directory, 'a', 31);
    addBackup(fx.directory, 'b', 32);
    addBackup(fx.directory, 'c', 33);
    addBackup(fx.directory, 'd', 34);

    const plan = buildBackupRetentionPlan({
      directory: fx.directory,
      signingKey: SIGNING_KEY,
      retentionDays: 30,
      keepMinimum: 3,
      now: NOW,
    });

    assert.equal(plan.deletable.length, 1);
    assert.equal(plan.retained, 3);
  } finally {
    fx.cleanup();
  }
});

test('fails closed before deletion when a dump checksum no longer matches its signed manifest', () => {
  const fx = fixture();
  try {
    const dumpPath = addBackup(fx.directory, 'tampered', 40);
    writeFileSync(dumpPath, 'tampered payload');

    assert.throws(
      () =>
        buildBackupRetentionPlan({
          directory: fx.directory,
          signingKey: SIGNING_KEY,
          retentionDays: 30,
          keepMinimum: 1,
          now: NOW,
        }),
      /checksum does not match signed manifest/,
    );
  } finally {
    fx.cleanup();
  }
});

test('fails closed when a manifest is missing or no longer authentic', () => {
  const fx = fixture();
  try {
    const dumpPath = addBackup(fx.directory, 'signed', 40);
    const manifestPath = `${dumpPath}.manifest.json`;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.createdAt = '2025-01-01T00:00:00.000Z';
    writeFileSync(manifestPath, JSON.stringify(manifest));

    assert.throws(
      () =>
        buildBackupRetentionPlan({
          directory: fx.directory,
          signingKey: SIGNING_KEY,
          retentionDays: 30,
          keepMinimum: 1,
          now: NOW,
        }),
      /authenticity check failed/,
    );

    rmSync(manifestPath);
    assert.throws(
      () =>
        buildBackupRetentionPlan({
          directory: fx.directory,
          signingKey: SIGNING_KEY,
          retentionDays: 30,
          keepMinimum: 1,
          now: NOW,
        }),
      /no matching manifest/,
    );
  } finally {
    fx.cleanup();
  }
});

test('refuses symbolic-link backup artifacts rather than following them', () => {
  const fx = fixture();
  try {
    const realDump = addBackup(fx.directory, 'real', 40);
    const linkedDump = join(fx.directory, 'linked.dump');
    const linkedManifest = `${linkedDump}.manifest.json`;
    symlinkSync(realDump, linkedDump);
    symlinkSync(`${realDump}.manifest.json`, linkedManifest);

    assert.throws(
      () =>
        buildBackupRetentionPlan({
          directory: fx.directory,
          signingKey: SIGNING_KEY,
          retentionDays: 30,
          keepMinimum: 1,
          now: NOW,
        }),
      /must not be a symbolic link/,
    );
  } finally {
    fx.cleanup();
  }
});

test('requires an explicit destructive confirmation and removes dump plus manifest as one planned pair', () => {
  const fx = fixture();
  try {
    addBackup(fx.directory, 'keep', 1);
    const oldDump = addBackup(fx.directory, 'delete', 40);
    const plan = buildBackupRetentionPlan({
      directory: fx.directory,
      signingKey: SIGNING_KEY,
      retentionDays: 30,
      keepMinimum: 1,
      now: NOW,
    });

    assert.throws(() => executeBackupRetentionPlan(plan, 'WRONG'), /PRUNE_KNOWME/);
    assert.equal(readFileSync(oldDump, 'utf8'), 'backup:delete');

    assert.equal(executeBackupRetentionPlan(plan, 'PRUNE_KNOWME'), 1);
    assert.throws(() => readFileSync(oldDump, 'utf8'));
    assert.throws(() => readFileSync(`${oldDump}.manifest.json`, 'utf8'));
  } finally {
    fx.cleanup();
  }
});

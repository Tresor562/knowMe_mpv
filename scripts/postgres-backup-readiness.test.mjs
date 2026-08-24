import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { manifestForBackup, sha256File } from './postgres-backup-lib.mjs';
import { verifyBackupReadiness } from './postgres-backup-retention-lib.mjs';

const SIGNING_KEY = 'readiness-signing-key-0123456789abcdef';
const NOW = new Date('2026-08-24T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'knowme-backup-readiness-'));
  return {
    directory,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

function addBackup(directory, name, createdAt) {
  const dumpPath = join(directory, `${name}.dump`);
  writeFileSync(dumpPath, `backup:${name}`);
  const manifest = manifestForBackup({
    filePath: dumpPath,
    sha256: sha256File(dumpPath),
    createdAt,
    signingKey: SIGNING_KEY,
  });
  writeFileSync(`${dumpPath}.manifest.json`, `${JSON.stringify(manifest)}\n`);
  return dumpPath;
}

test('passes only when enough authentic backups exist and the newest is fresh enough', () => {
  const fx = fixture();
  try {
    addBackup(fx.directory, 'newest', new Date(NOW.getTime() - 2 * HOUR_MS));
    addBackup(fx.directory, 'older', new Date(NOW.getTime() - 12 * HOUR_MS));

    const result = verifyBackupReadiness({
      directory: fx.directory,
      signingKey: SIGNING_KEY,
      keepMinimum: 2,
      maxAgeHours: 24,
      now: NOW,
    });

    assert.equal(result.total, 2);
    assert.equal(result.keepMinimum, 2);
    assert.equal(result.maxAgeHours, 24);
    assert.equal(result.newestAgeHours, 2);
    assert.equal(result.newestCreatedAt, '2026-08-24T10:00:00.000Z');
  } finally {
    fx.cleanup();
  }
});

test('fails when the verified backup count is below the configured minimum', () => {
  const fx = fixture();
  try {
    addBackup(fx.directory, 'only', new Date(NOW.getTime() - HOUR_MS));
    assert.throws(
      () =>
        verifyBackupReadiness({
          directory: fx.directory,
          signingKey: SIGNING_KEY,
          keepMinimum: 2,
          maxAgeHours: 24,
          now: NOW,
        }),
      /require at least 2/,
    );
  } finally {
    fx.cleanup();
  }
});

test('fails when the newest authentic backup is older than the maximum age', () => {
  const fx = fixture();
  try {
    addBackup(fx.directory, 'stale', new Date(NOW.getTime() - 25 * HOUR_MS));
    assert.throws(
      () =>
        verifyBackupReadiness({
          directory: fx.directory,
          signingKey: SIGNING_KEY,
          keepMinimum: 1,
          maxAgeHours: 24,
          now: NOW,
        }),
      /older than 24 hour/,
    );
  } finally {
    fx.cleanup();
  }
});

test('fails closed when a backup payload no longer matches its signed manifest', () => {
  const fx = fixture();
  try {
    const dumpPath = addBackup(
      fx.directory,
      'tampered',
      new Date(NOW.getTime() - HOUR_MS),
    );
    writeFileSync(dumpPath, 'tampered payload');

    assert.throws(
      () =>
        verifyBackupReadiness({
          directory: fx.directory,
          signingKey: SIGNING_KEY,
          keepMinimum: 1,
          maxAgeHours: 24,
          now: NOW,
        }),
      /checksum does not match signed manifest/,
    );
  } finally {
    fx.cleanup();
  }
});

test('refuses a future-dated newest backup rather than treating it as fresh', () => {
  const fx = fixture();
  try {
    addBackup(fx.directory, 'future', new Date(NOW.getTime() + 60 * 1000));
    assert.throws(
      () =>
        verifyBackupReadiness({
          directory: fx.directory,
          signingKey: SIGNING_KEY,
          keepMinimum: 1,
          maxAgeHours: 24,
          now: NOW,
        }),
      /creation time is in the future/,
    );
  } finally {
    fx.cleanup();
  }
});

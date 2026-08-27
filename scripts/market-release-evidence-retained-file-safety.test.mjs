import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  RETAINED_RELEASE_ARTIFACT_LIMITS,
  readRetainedReleaseArtifact,
} from './market-release-evidence-retained-bundle-preflight.mjs';

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd-282-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('reads a bounded regular retained artifact', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'manifest.json');
    const expected = Buffer.from('{"ok":true}\n');
    await writeFile(path, expected);

    const actual = await readRetainedReleaseArtifact(path, {
      label: 'manifest',
      maxBytes: RETAINED_RELEASE_ARTIFACT_LIMITS.manifest,
    });

    assert.deepEqual(actual, expected);
  });
});

test('supports bounded UTF-8 digest reads', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'manifest.sha256');
    await writeFile(path, `${'a'.repeat(64)}  manifest.json\n`, 'utf8');

    const actual = await readRetainedReleaseArtifact(path, {
      label: 'digest',
      maxBytes: RETAINED_RELEASE_ARTIFACT_LIMITS.digest,
      encoding: 'utf8',
    });

    assert.equal(actual, `${'a'.repeat(64)}  manifest.json\n`);
  });
});

test('rejects empty retained artifacts', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'empty.json');
    await writeFile(path, Buffer.alloc(0));

    await assert.rejects(
      readRetainedReleaseArtifact(path, { label: 'receipt', maxBytes: 32 }),
      /between 1 and 32 bytes/,
    );
  });
});

test('rejects retained artifacts larger than their explicit budget', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'oversized.json');
    await writeFile(path, Buffer.alloc(33, 0x61));

    await assert.rejects(
      readRetainedReleaseArtifact(path, { label: 'receipt', maxBytes: 32 }),
      /between 1 and 32 bytes/,
    );
  });
});

test('accepts an artifact exactly at the configured byte limit', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'exact.bin');
    const expected = Buffer.alloc(32, 0x62);
    await writeFile(path, expected);

    const actual = await readRetainedReleaseArtifact(path, { label: 'receipt', maxBytes: 32 });
    assert.equal(actual.length, 32);
    assert.deepEqual(actual, expected);
  });
});

test('rejects directories instead of reading arbitrary filesystem objects', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'not-a-file');
    await mkdir(path);

    await assert.rejects(
      readRetainedReleaseArtifact(path, { label: 'manifest', maxBytes: 32 }),
      /must be a regular file/,
    );
  });
});

test('rejects symbolic links to retained release artifacts', { skip: process.platform === 'win32' }, async () => {
  await withTempDir(async (dir) => {
    const target = join(dir, 'target.json');
    const link = join(dir, 'manifest.json');
    await writeFile(target, '{"signed":true}\n');
    await symlink(target, link);

    await assert.rejects(
      readRetainedReleaseArtifact(link, { label: 'manifest', maxBytes: 1024 }),
      /must not be a symbolic link/,
    );
  });
});

test('rejects invalid file-size budgets before reading', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'manifest.json');
    await writeFile(path, '{}');

    await assert.rejects(
      readRetainedReleaseArtifact(path, { label: 'manifest', maxBytes: 0 }),
      /maxBytes must be a positive safe integer/,
    );
  });
});

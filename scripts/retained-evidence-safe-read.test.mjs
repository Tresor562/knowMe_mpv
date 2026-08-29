import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

async function withTempDir(run) {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-retained-evidence-'));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('reads a regular file within the configured bound', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'item.json');
    await writeFile(path, '{"ok":true}\n', 'utf8');
    const value = await readRetainedEvidenceFile(path, 'item', {
      encoding: 'utf8',
      maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.item,
    });
    assert.equal(value, '{"ok":true}\n');
  });
});

test('rejects a retained evidence file above its configured limit', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'receipt.json');
    await writeFile(path, Buffer.alloc(33, 0x61));
    await assert.rejects(
      readRetainedEvidenceFile(path, 'receipt', { maxBytes: 32 }),
      /exceeds the maximum retained evidence size of 32 bytes/,
    );
  });
});

test('rejects symbolic links instead of following them', async (t) => {
  if (process.platform === 'win32') {
    t.skip('symlink creation is not reliably available without elevated Windows privileges');
    return;
  }
  await withTempDir(async (dir) => {
    const target = join(dir, 'artifact-real');
    const linked = join(dir, 'artifact');
    await writeFile(target, 'proof', 'utf8');
    await symlink(target, linked);
    await assert.rejects(
      readRetainedEvidenceFile(linked, 'artifact', { maxBytes: 1024 }),
      /regular non-symlink file/,
    );
  });
});

test('fails closed on invalid size configuration', async () => {
  await assert.rejects(
    readRetainedEvidenceFile('/does/not/matter', 'artifact', { maxBytes: 0 }),
    /invalid retained evidence size limit/,
  );
});

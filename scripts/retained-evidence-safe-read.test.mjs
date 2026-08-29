import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
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

test('standalone promotion CLI rejects a retained artifact symlink before promotion', async (t) => {
  if (process.platform === 'win32') {
    t.skip('symlink creation is not reliably available without elevated Windows privileges');
    return;
  }
  await withTempDir(async (dir) => {
    const itemPath = join(dir, 'item.json');
    const worksheetPath = join(dir, 'worksheet.json');
    const receiptPath = join(dir, 'review-receipt.json');
    const realArtifactPath = join(dir, 'artifact-real');
    const artifactPath = join(dir, 'artifact');
    await Promise.all([
      writeFile(itemPath, '{}', 'utf8'),
      writeFile(worksheetPath, '{}', 'utf8'),
      writeFile(receiptPath, '{}', 'utf8'),
      writeFile(realArtifactPath, 'proof', 'utf8'),
    ]);
    await symlink(realArtifactPath, artifactPath);

    const script = fileURLToPath(new URL('./manual-release-evidence-promotion-preflight.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [
      script,
      '--item', itemPath,
      '--artifact', artifactPath,
      '--worksheet', worksheetPath,
      '--review-receipt', receiptPath,
      '--commit', 'a'.repeat(40),
      '--version', '1.0.0-rc.1',
    ], { encoding: 'utf8' });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /retained artifact must be a regular non-symlink file/);
  });
});

test('fails closed on invalid size configuration', async () => {
  await assert.rejects(
    readRetainedEvidenceFile('/does/not/matter', 'artifact', { maxBytes: 0 }),
    /invalid retained evidence size limit/,
  );
});

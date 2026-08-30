import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { inspectKmdDeliveryRegistry } from './kmd-delivery-registry-preflight.mjs';

async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), 'knowme-kmd-registry-'));
  const roadmapDir = join(root, 'docs', 'roadmap');
  await mkdir(roadmapDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(roadmapDir, name), content, 'utf8');
  }
  return { root, roadmapDir };
}

test('accepts canonical KMD delivery filenames with matching headings', async () => {
  const { root, roadmapDir } = await fixture({
    'KMD_060_DELIVERY.md': '# KMD-060 — Deep links\n',
    'KMD_346_DELIVERY.md': '# KMD-346 — Governance\n',
  });
  try {
    const result = await inspectKmdDeliveryRegistry({ roadmapDir });
    assert.equal(result.ok, true);
    assert.equal(result.maxId, 346);
    assert.deepEqual(result.deliveries.map((entry) => entry.id), [60, 346]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails closed when a delivery filename and heading disagree', async () => {
  const { root, roadmapDir } = await fixture({
    'KMD_060_DELIVERY.md': '# KMD-060 — Deep links\n',
    'KMD_347_DELIVERY.md': '# KMD-346 — Wrong reused id\n',
  });
  try {
    const result = await inspectKmdDeliveryRegistry({ roadmapDir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /KMD_347_DELIVERY\.md must start with a matching '# KMD-347' heading/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ignores non-canonical filenames instead of treating aliases as delivery ids', async () => {
  const { root, roadmapDir } = await fixture({
    'KMD_060_DELIVERY.md': '# KMD-060 — Deep links\n',
    'KMD-999-notes.md': '# KMD-999 — Notes only\n',
  });
  try {
    const result = await inspectKmdDeliveryRegistry({ roadmapDir });
    assert.equal(result.ok, true);
    assert.equal(result.maxId, 60);
    assert.deepEqual(result.deliveries.map((entry) => entry.file), ['KMD_060_DELIVERY.md']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

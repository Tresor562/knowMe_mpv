import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowUrl = new URL('../.github/workflows/ci.yml', import.meta.url);
const SHA_PINNED_ACTION = /^\s*- uses: ([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([0-9a-f]{40})(?:\s+#.*)?$/;

test('CI grants only read access to repository contents by default', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  assert.match(workflow, /\npermissions:\n  contents: read\n/);
  assert.doesNotMatch(workflow, /permissions:\s*write-all/);
});

test('every external GitHub Action in CI is pinned to an immutable commit SHA', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const usesLines = workflow.split('\n').filter((line) => /^\s*- uses:/.test(line));

  assert.ok(usesLines.length > 0, 'CI must keep at least one explicitly audited external action.');
  for (const line of usesLines) {
    const match = line.match(SHA_PINNED_ACTION);
    assert.ok(match, `External action must be pinned to an exact 40-character commit SHA: ${line.trim()}`);
  }
});

test('CI does not reintroduce mutable major-version action tags', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  assert.doesNotMatch(workflow, /uses:\s+[^\s@]+@v\d+(?:\s|$)/);
});

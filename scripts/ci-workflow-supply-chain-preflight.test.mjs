import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowUrl = new URL('../.github/workflows/ci.yml', import.meta.url);
const apiDockerfileUrl = new URL('../Dockerfile.api', import.meta.url);
const webDockerfileUrl = new URL('../Dockerfile.web', import.meta.url);
const composeUrl = new URL('../docker-compose.yml', import.meta.url);
const SHA_PINNED_ACTION = /^\s*- uses: ([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([0-9a-f]{40})(?:\s+#.*)?$/;
const DIGEST_PINNED_POSTGRES = /^\s*image:\s+postgres:16\.15-alpine@sha256:[0-9a-f]{64}\s*$/m;
const DIGEST_PINNED_NODE = /^FROM node:22\.23\.2-alpine@sha256:[0-9a-f]{64}$/m;
const PINNED_CI_NODE_VERSION = /^\s*node-version:\s*22\.23\.2\s*$/m;

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

test('CI Node runtime is pinned to the audited exact patch version', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  assert.match(workflow, PINNED_CI_NODE_VERSION);
  assert.doesNotMatch(workflow, /^\s*node-version:\s*22\s*$/m);
});

test('CI PostgreSQL service is pinned to an immutable image digest', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  assert.match(workflow, DIGEST_PINNED_POSTGRES);
  assert.doesNotMatch(workflow, /^\s*image:\s+postgres:16-alpine\s*$/m);
});

test('runtime Dockerfiles pin the audited Node image to an immutable digest', async () => {
  for (const dockerfileUrl of [apiDockerfileUrl, webDockerfileUrl]) {
    const dockerfile = await readFile(dockerfileUrl, 'utf8');
    assert.match(dockerfile, DIGEST_PINNED_NODE);
    assert.doesNotMatch(dockerfile, /^FROM node:22-alpine$/m);
  }
});

test('docker-compose PostgreSQL service is pinned to the audited immutable digest', async () => {
  const compose = await readFile(composeUrl, 'utf8');
  assert.match(compose, DIGEST_PINNED_POSTGRES);
  assert.doesNotMatch(compose, /^\s*image:\s+postgres:16-alpine\s*$/m);
});

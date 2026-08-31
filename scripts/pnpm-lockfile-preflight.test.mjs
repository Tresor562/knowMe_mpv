import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const lockfileUrl = new URL('../pnpm-lock.yaml', import.meta.url);
const packageJsonUrl = new URL('../package.json', import.meta.url);
const ciUrl = new URL('../.github/workflows/ci.yml', import.meta.url);

test('canonical PNPM lockfile exists and is non-empty', async () => {
  const info = await stat(lockfileUrl);
  assert.ok(info.isFile(), 'pnpm-lock.yaml must be a committed file.');
  assert.ok(info.size > 0, 'pnpm-lock.yaml must not be empty.');
});

test('canonical lockfile matches the repository PNPM lockfile format', async () => {
  const lockfile = await readFile(lockfileUrl, 'utf8');
  assert.match(lockfile, /^lockfileVersion: '9\.0'$/m);
  assert.match(lockfile, /^importers:$/m);
});

test('repository pins the PNPM version used to maintain the lockfile', async () => {
  const packageJson = JSON.parse(await readFile(packageJsonUrl, 'utf8'));
  assert.equal(packageJson.packageManager, 'pnpm@10.13.1');
});

test('canonical CI refuses dependency resolution drift', async () => {
  const workflow = await readFile(ciUrl, 'utf8');
  assert.match(workflow, /pnpm install --frozen-lockfile(?:\s|$)/);
  assert.doesNotMatch(workflow, /pnpm install[^\n]*--frozen-lockfile=false/);
});

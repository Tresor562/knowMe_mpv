import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateMarketReleaseEvidencePlanCommandContract } from './market-release-evidence-plan-contract.mjs';

const packagePath = new URL('../package.json', import.meta.url);
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));

test('every executable market evidence workflow step resolves to a real root package script', () => {
  const result = validateMarketReleaseEvidencePlanCommandContract(packageJson);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.commands.length > 0, true);
  assert.equal(result.commands.every((entry) => packageJson.scripts[entry.script]), true);
});

test('contract fails closed when a referenced root script disappears', () => {
  const broken = structuredClone(packageJson);
  delete broken.scripts['release:tls-domain:smoke'];
  const result = validateMarketReleaseEvidencePlanCommandContract(broken);
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.includes('release:tls-domain:smoke')), true);
});

test('contract rejects a package without a scripts object', () => {
  const result = validateMarketReleaseEvidencePlanCommandContract({});
  assert.deepEqual(result, {
    ok: false,
    errors: ['package.json scripts must be an object.'],
    commands: [],
  });
});

test('plan contract CLI accepts the regular root package.json', () => {
  const result = spawnSync(process.execPath, ['scripts/market-release-evidence-plan-contract.mjs', 'package.json'], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Market evidence plan command contract OK/);
});

test('plan contract CLI rejects a symlinked package input before JSON ingestion', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'knowme-plan-contract-'));
  try {
    const linkedPath = path.join(dir, 'package.json');
    await symlink(path.resolve('package.json'), linkedPath);
    const result = spawnSync(process.execPath, ['scripts/market-release-evidence-plan-contract.mjs', linkedPath], {
      cwd: path.resolve('.'),
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /regular non-symlink file/);
    assert.equal(result.stdout, '');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

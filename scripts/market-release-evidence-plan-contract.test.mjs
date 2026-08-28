import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { validateMarketReleaseEvidencePlanCommandContract } from './market-release-evidence-plan-contract.mjs';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

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

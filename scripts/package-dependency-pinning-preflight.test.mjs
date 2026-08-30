import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifestPaths = [
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'apps/mobile/package.json',
  'packages/animation-contract/package.json',
  'packages/i18n-contract/package.json',
  'packages/link-contract/package.json',
  'packages/media-cache-contract/package.json',
];

const exactSemver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const allowedLocalProtocols = /^(?:workspace:|file:|link:)/;
const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies'];
const auditedSecurityOverrides = {
  'path-to-regexp': '8.4.2',
  lodash: '4.18.1',
};

async function readManifest(path) {
  const url = new URL(`../${path}`, import.meta.url);
  return JSON.parse(await readFile(url, 'utf8'));
}

test('all direct registry dependencies are pinned to exact versions', async () => {
  const violations = [];

  for (const path of manifestPaths) {
    const manifest = await readManifest(path);
    for (const section of dependencySections) {
      for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
        if (allowedLocalProtocols.test(spec)) continue;
        if (!exactSemver.test(spec)) violations.push(`${path}:${section}:${name}=${spec}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Direct registry dependencies must use exact versions. Violations: ${violations.join(', ')}`,
  );
});

test('the package manager version itself stays exact', async () => {
  const root = await readManifest('package.json');
  assert.match(root.packageManager ?? '', /^pnpm@\d+\.\d+\.\d+$/);
});

test('audited transitive security overrides stay on reviewed fixed versions', async () => {
  const root = await readManifest('package.json');
  for (const [name, version] of Object.entries(auditedSecurityOverrides)) {
    assert.equal(root.pnpm?.overrides?.[name], version, `${name} must remain pinned to the reviewed fixed version.`);
  }
});

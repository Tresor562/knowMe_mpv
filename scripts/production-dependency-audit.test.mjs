import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = new URL('./production-dependency-audit.mjs', import.meta.url).pathname;

async function run(report, exitCode = 1) {
  const dir = await mkdtemp(path.join(tmpdir(), 'knowme-audit-'));
  const reportPath = path.join(dir, 'audit.json');
  await writeFile(reportPath, JSON.stringify(report));
  return spawnSync(process.execPath, [script, reportPath, String(exitCode)], {
    encoding: 'utf8'
  });
}

function advisory({ id, name, severity = 'high', path: dependencyPath }) {
  return {
    id,
    url: `https://github.com/advisories/${id}`,
    module_name: name,
    severity,
    findings: [{ paths: [dependencyPath] }]
  };
}

test('accepts only the two reviewed unpatched mobile build-tool findings', async () => {
  const result = await run({
    advisories: {
      1: advisory({
        id: 'GHSA-86w9-cpqp-85rv',
        name: 'node-forge',
        path: 'apps__mobile>expo>@expo/cli>node-forge'
      }),
      2: advisory({
        id: 'GHSA-vfj7-8cjw-p6xm',
        name: 'braces',
        path: 'apps__mobile>react-native>@react-native/community-cli-plugin>metro>metro-file-map>micromatch>braces'
      })
    }
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /QUARANTINED GHSA-86w9-cpqp-85rv/);
  assert.match(result.stderr, /QUARANTINED GHSA-vfj7-8cjw-p6xm/);
});

test('fails closed if a reviewed advisory reaches any other dependency path', async () => {
  const result = await run({
    advisories: {
      1: advisory({
        id: 'GHSA-vfj7-8cjw-p6xm',
        name: 'braces',
        path: 'apps__api>some-runtime-package>braces'
      })
    }
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Blocking high\/critical/);
});

test('fails on any new high or critical advisory', async () => {
  const result = await run({
    advisories: {
      1: advisory({
        id: 'GHSA-aaaa-bbbb-cccc',
        name: 'example-runtime-package',
        severity: 'critical',
        path: 'apps__api>example-runtime-package'
      })
    }
  });

  assert.equal(result.status, 1);
});

test('fails closed when pnpm audit fails but the report cannot prove the severe findings', async () => {
  const result = await run({ advisories: {} }, 1);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Failing closed/);
});

test('passes a clean audit', async () => {
  const result = await run({ advisories: {} }, 0);
  assert.equal(result.status, 0, result.stderr);
});

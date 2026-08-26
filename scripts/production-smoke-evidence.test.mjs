import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createProductionSmokeEvidence,
  sha256Text,
} from './production-smoke-evidence.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const metricsToken = 'm'.repeat(32);

function successfulDeployment() {
  return async () => ({ ok: true, readyUrl: 'https://knowme.example/health/ready', release: { commit, version } });
}

function successfulMetrics() {
  return async () => ({ ok: true, metricsUrl: 'https://knowme.example/health/metrics' });
}

test('writes a bounded secret-free evidence artifact and returns its SHA-256', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'knowme-smoke-evidence-'));
  const outputPath = path.join(dir, 'smoke.json');

  const result = await createProductionSmokeEvidence({
    baseUrl: 'https://knowme.example',
    expectedCommit: commit,
    expectedVersion: version,
    metricsToken,
    outputPath,
    timeoutMs: 1000,
    now: () => new Date('2026-08-26T17:00:00.000Z'),
    verifyDeploymentImpl: successfulDeployment(),
    verifyMetricsImpl: successfulMetrics(),
  });

  const raw = await readFile(outputPath, 'utf8');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.type, 'knowme-production-smoke-evidence');
  assert.equal(parsed.observedAt, '2026-08-26T17:00:00.000Z');
  assert.equal(parsed.productionOrigin, 'https://knowme.example/');
  assert.deepEqual(parsed.release, { commit, version });
  assert.equal(parsed.checks.deploymentReadiness.passed, true);
  assert.equal(parsed.checks.metricsSurface.passed, true);
  assert.equal(raw.includes(metricsToken), false);
  assert.equal(result.sha256, sha256Text(raw));
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
});

test('passes the same production origin and timeout to both authoritative smoke verifiers', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'knowme-smoke-evidence-'));
  const calls = [];

  await createProductionSmokeEvidence({
    baseUrl: 'https://knowme.example',
    expectedCommit: commit,
    expectedVersion: version,
    metricsToken,
    outputPath: path.join(dir, 'smoke.json'),
    timeoutMs: 2500,
    verifyDeploymentImpl: async (args) => {
      calls.push(['deployment', args]);
      return { ok: true };
    },
    verifyMetricsImpl: async (args) => {
      calls.push(['metrics', args]);
      return { ok: true };
    },
  });

  assert.equal(calls[0][0], 'deployment');
  assert.equal(calls[0][1].baseUrl, 'https://knowme.example/');
  assert.equal(calls[0][1].timeoutMs, 2500);
  assert.equal(calls[1][0], 'metrics');
  assert.equal(calls[1][1].baseUrl, 'https://knowme.example/');
  assert.equal(calls[1][1].timeoutMs, 2500);
  assert.equal(calls[1][1].metricsToken, metricsToken);
});

test('does not write an artifact if either smoke verifier fails', async () => {
  const writes = [];
  await assert.rejects(
    createProductionSmokeEvidence({
      baseUrl: 'https://knowme.example',
      expectedCommit: commit,
      expectedVersion: version,
      metricsToken,
      outputPath: 'ignored.json',
      verifyDeploymentImpl: successfulDeployment(),
      verifyMetricsImpl: async () => {
        throw new Error('metrics unavailable');
      },
      writeFileImpl: async (...args) => writes.push(args),
    }),
    /metrics unavailable/,
  );
  assert.equal(writes.length, 0);
});

test('refuses unsafe origins, invalid output paths and out-of-range timeouts before network verification', async () => {
  let called = false;
  const verifier = async () => {
    called = true;
    return { ok: true };
  };

  await assert.rejects(
    createProductionSmokeEvidence({
      baseUrl: 'http://knowme.example',
      expectedCommit: commit,
      expectedVersion: version,
      metricsToken,
      outputPath: 'smoke.json',
      verifyDeploymentImpl: verifier,
      verifyMetricsImpl: verifier,
    }),
    /canonical HTTPS origin/,
  );
  await assert.rejects(
    createProductionSmokeEvidence({
      baseUrl: 'https://knowme.example',
      expectedCommit: commit,
      expectedVersion: version,
      metricsToken,
      outputPath: ' smoke.json ',
      verifyDeploymentImpl: verifier,
      verifyMetricsImpl: verifier,
    }),
    /output path/,
  );
  await assert.rejects(
    createProductionSmokeEvidence({
      baseUrl: 'https://knowme.example',
      expectedCommit: commit,
      expectedVersion: version,
      metricsToken,
      outputPath: 'smoke.json',
      timeoutMs: 499,
      verifyDeploymentImpl: verifier,
      verifyMetricsImpl: verifier,
    }),
    /between 500 and 10000 ms/,
  );
  assert.equal(called, false);
});

test('uses exclusive file creation so existing evidence cannot be silently overwritten', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'knowme-smoke-evidence-'));
  const outputPath = path.join(dir, 'smoke.json');

  await createProductionSmokeEvidence({
    baseUrl: 'https://knowme.example',
    expectedCommit: commit,
    expectedVersion: version,
    metricsToken,
    outputPath,
    verifyDeploymentImpl: successfulDeployment(),
    verifyMetricsImpl: successfulMetrics(),
  });

  await assert.rejects(
    createProductionSmokeEvidence({
      baseUrl: 'https://knowme.example',
      expectedCommit: commit,
      expectedVersion: version,
      metricsToken,
      outputPath,
      verifyDeploymentImpl: successfulDeployment(),
      verifyMetricsImpl: successfulMetrics(),
    }),
    /EEXIST/,
  );
});

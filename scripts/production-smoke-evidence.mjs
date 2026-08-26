#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import {
  canonicalProductionBaseUrl,
  verifyProductionDeployment,
} from './production-deployment-smoke.mjs';
import { verifyProductionMetrics } from './production-metrics-smoke.mjs';

const DEFAULT_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 10_000;

function canonicalTimeout(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_TIMEOUT_MS;
  if (typeof value !== 'string' || value !== value.trim() || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= MIN_TIMEOUT_MS && parsed <= MAX_TIMEOUT_MS ? parsed : null;
}

function canonicalObservedAt(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

function serializeArtifact(artifact) {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

export function sha256Text(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export async function createProductionSmokeEvidence({
  baseUrl,
  expectedCommit,
  expectedVersion,
  metricsToken,
  outputPath,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = () => new Date(),
  verifyDeploymentImpl = verifyProductionDeployment,
  verifyMetricsImpl = verifyProductionMetrics,
  writeFileImpl = writeFile,
} = {}) {
  const productionOrigin = canonicalProductionBaseUrl(baseUrl);
  if (productionOrigin === null) {
    throw new Error('Production base URL must be a canonical HTTPS origin without credentials, path, query, or fragment.');
  }
  if (typeof outputPath !== 'string' || outputPath !== outputPath.trim() || outputPath.length === 0) {
    throw new Error('Smoke evidence output path is required and must be canonical.');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`Smoke evidence timeout must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`);
  }

  const observedAt = canonicalObservedAt(now());
  if (observedAt === null) throw new Error('Smoke evidence timestamp must be a valid Date.');

  const deployment = await verifyDeploymentImpl({
    baseUrl: productionOrigin,
    expectedCommit,
    expectedVersion,
    timeoutMs,
  });
  const metrics = await verifyMetricsImpl({
    baseUrl: productionOrigin,
    metricsToken,
    timeoutMs,
  });

  if (!deployment?.ok || !metrics?.ok) {
    throw new Error('Production smoke verification did not return successful bounded results.');
  }

  const artifact = {
    schemaVersion: 1,
    type: 'knowme-production-smoke-evidence',
    observedAt,
    productionOrigin,
    release: {
      commit: expectedCommit,
      version: expectedVersion,
    },
    checks: {
      deploymentReadiness: {
        passed: true,
        endpoint: new URL('health/ready', productionOrigin).toString(),
      },
      metricsSurface: {
        passed: true,
        endpoint: new URL('health/metrics', productionOrigin).toString(),
      },
    },
  };

  const serialized = serializeArtifact(artifact);
  const sha256 = sha256Text(serialized);
  await writeFileImpl(outputPath, serialized, { encoding: 'utf8', flag: 'wx', mode: 0o600 });

  return { artifact, sha256, outputPath };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const baseUrl = readArg('--url') ?? process.env.KNOWME_PRODUCTION_BASE_URL;
  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const metricsToken = process.env.METRICS_BEARER_TOKEN;
  const outputPath = readArg('--output');
  const rawTimeout = readArg('--timeout-ms') ?? process.env.KNOWME_PRODUCTION_SMOKE_TIMEOUT_MS;
  const timeoutMs = canonicalTimeout(rawTimeout);
  if (timeoutMs === null) {
    throw new Error(`Smoke evidence timeout must be a canonical integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`);
  }

  const result = await createProductionSmokeEvidence({
    baseUrl,
    expectedCommit,
    expectedVersion,
    metricsToken,
    outputPath,
    timeoutMs,
  });
  console.log(`Production smoke evidence written to ${result.outputPath}.`);
  console.log(`SHA256 ${result.sha256}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

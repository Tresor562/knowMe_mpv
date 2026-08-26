#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function canonicalTimestamp(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function canonicalEvidenceRef(value) {
  if (typeof value !== 'string' || value !== value.trim() || CONTROL_CHARACTERS.test(value)) return null;
  try {
    const parsed = new URL(value);
    if (!['https:', 'evidence:'].includes(parsed.protocol)) return null;
    if (!parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return value;
  } catch {
    return null;
  }
}

export function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function buildProductionDeploymentSmokeEvidenceItem({
  artifactBytes,
  artifact,
  expectedCommit,
  expectedVersion,
  verifier,
  evidenceRef,
  validUntil,
  now = new Date(),
} = {}) {
  const errors = [];
  if (!Buffer.isBuffer(artifactBytes)) errors.push('artifactBytes must be the exact persisted Buffer.');
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) errors.push('artifact must be a JSON object.');
  if (!SHA40.test(expectedCommit ?? '')) errors.push('expectedCommit must be a lowercase 40-character Git SHA.');
  if (!RELEASE_VERSION.test(expectedVersion ?? '')) errors.push('expectedVersion must be a canonical SemVer without build metadata.');
  if (typeof verifier !== 'string' || verifier !== verifier.trim() || verifier.length < 1 || verifier.length > 128 || CONTROL_CHARACTERS.test(verifier)) {
    errors.push('verifier must be canonical, non-empty, free of control characters, and at most 128 characters.');
  }
  if (canonicalEvidenceRef(evidenceRef) === null) errors.push('evidenceRef must be a canonical credential-free HTTPS or evidence URI without query or fragment.');

  const nowMs = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : NaN;
  const validUntilMs = canonicalTimestamp(validUntil);
  if (!Number.isFinite(nowMs)) errors.push('now must be a valid Date.');
  if (validUntilMs === null) errors.push('validUntil must be a canonical ISO-8601 UTC timestamp.');

  if (artifact && typeof artifact === 'object') {
    if (artifact.schemaVersion !== 1 || artifact.type !== 'knowme-production-smoke-evidence') errors.push('artifact schema/type is not KMD-265 production smoke evidence.');
    if (artifact.release?.commit !== expectedCommit) errors.push('artifact release commit does not match expectedCommit.');
    if (artifact.release?.version !== expectedVersion) errors.push('artifact release version does not match expectedVersion.');
    if (artifact.checks?.deploymentReadiness?.passed !== true || artifact.checks?.metricsSurface?.passed !== true) errors.push('artifact does not contain both successful smoke checks.');
    const observedAtMs = canonicalTimestamp(artifact.observedAt);
    if (observedAtMs === null) errors.push('artifact observedAt must be canonical UTC.');
    else {
      if (Number.isFinite(nowMs) && observedAtMs > nowMs + 5 * 60_000) errors.push('artifact observedAt must not be in the future.');
      if (validUntilMs !== null && validUntilMs <= observedAtMs) errors.push('validUntil must be later than artifact observedAt.');
      if (validUntilMs !== null && Number.isFinite(nowMs) && validUntilMs <= nowMs) errors.push('validUntil must still be in the future.');
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    item: {
      id: 'production_deployment_smoke',
      status: 'VERIFIED',
      verifiedAt: artifact.observedAt,
      validUntil,
      verifier,
      evidenceRef,
      evidenceSha256: sha256Buffer(artifactBytes),
    },
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const artifactPath = readArg('--artifact');
  const outputPath = readArg('--output');
  if (!artifactPath || !outputPath) throw new Error('Provide --artifact <file> and --output <file>.');
  const artifactBytes = await readFile(artifactPath);
  const artifact = JSON.parse(artifactBytes.toString('utf8'));
  const result = buildProductionDeploymentSmokeEvidenceItem({
    artifactBytes,
    artifact,
    expectedCommit: readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA,
    expectedVersion: readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION,
    verifier: readArg('--verifier'),
    evidenceRef: readArg('--evidence-ref'),
    validUntil: readArg('--valid-until'),
  });
  if (!result.ok) throw new Error(result.errors.join(' '));
  await writeFile(outputPath, `${JSON.stringify(result.item, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log(`Production deployment smoke evidence item written to ${outputPath}.`);
  console.log(`Artifact SHA256 ${result.item.evidenceSha256}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

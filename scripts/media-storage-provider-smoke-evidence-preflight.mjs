#!/usr/bin/env node

import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const REGION = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const TOP_LEVEL_FIELDS = new Set([
  'schemaVersion',
  'kind',
  'status',
  'observedAt',
  'endpointSha256',
  'bucketSha256',
  'region',
  'canaryBytes',
  'checks',
]);
const CHECK_FIELDS = new Set([
  'signedPut',
  'anonymousReadDenied',
  'signedReadMatched',
  'signedDelete',
  'postDeleteNotFound',
]);

function exactFields(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function canonicalTimestamp(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

export function validateObjectStorageProviderSmokeArtifact(artifact, { now = new Date() } = {}) {
  const errors = [];
  if (!exactFields(artifact, TOP_LEVEL_FIELDS)) {
    return { ok: false, errors: ['Object-storage smoke artifact must match the exact schema-v1 field contract.'] };
  }

  if (artifact.schemaVersion !== 1) errors.push('Object-storage smoke schemaVersion must equal 1.');
  if (artifact.kind !== 'knowme-object-storage-provider-smoke') errors.push('Object-storage smoke kind is invalid.');
  if (artifact.status !== 'PASSED') errors.push('Object-storage smoke status must equal PASSED.');

  const nowMs = now instanceof Date && Number.isFinite(now.getTime()) ? now.getTime() : NaN;
  if (!Number.isFinite(nowMs)) errors.push('now must be a valid Date.');
  const observedAt = canonicalTimestamp(artifact.observedAt);
  if (observedAt === null) errors.push('Object-storage smoke observedAt must be a canonical UTC timestamp.');
  else if (Number.isFinite(nowMs) && observedAt > nowMs + 5 * 60_000) errors.push('Object-storage smoke observedAt must not be in the future.');

  if (typeof artifact.endpointSha256 !== 'string' || !SHA256.test(artifact.endpointSha256)) {
    errors.push('Object-storage endpoint SHA-256 is invalid.');
  }
  if (typeof artifact.bucketSha256 !== 'string' || !SHA256.test(artifact.bucketSha256)) {
    errors.push('Object-storage bucket SHA-256 is invalid.');
  }
  if (typeof artifact.region !== 'string' || artifact.region !== artifact.region.trim() || !REGION.test(artifact.region)) {
    errors.push('Object-storage region is invalid.');
  }
  if (artifact.canaryBytes !== 32) errors.push('Object-storage smoke canaryBytes must equal 32.');

  if (!exactFields(artifact.checks, CHECK_FIELDS)) {
    errors.push('Object-storage smoke checks must match the exact contract.');
  } else {
    for (const field of CHECK_FIELDS) {
      if (artifact.checks[field] !== true) errors.push(`Object-storage smoke check ${field} must equal true.`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, verifiedAt: artifact.observedAt };
}

export async function validateRetainedObjectStorageSmoke(path, options = {}) {
  const bytes = await readRetainedEvidenceFile(path, 'object-storage retained smoke artifact', {
    maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.artifact,
  });
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { ok: false, errors: ['Object-storage smoke artifact must contain valid JSON.'] };
  }
  return validateObjectStorageProviderSmokeArtifact(artifact, options);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const artifactPath = readArg('--artifact');
  if (!artifactPath) throw new Error('Provide --artifact.');
  const result = await validateRetainedObjectStorageSmoke(artifactPath);
  if (!result.ok) throw new Error(result.errors.join(' '));
  console.log(`Object-storage retained smoke artifact is semantically valid; verifiedAt=${result.verifiedAt}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Object-storage retained smoke preflight failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

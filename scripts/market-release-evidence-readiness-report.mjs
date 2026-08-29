#!/usr/bin/env node

import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';
import { readRetainedEvidenceFile, RETAINED_EVIDENCE_FILE_LIMITS } from './retained-evidence-safe-read.mjs';

const SCOPES = new Set(['WEB_V1', 'FULL']);
const EVIDENCE_STATUSES = new Set(['PENDING', 'VERIFIED']);

function canonicalUtcTimestamp(value) {
  if (typeof value !== 'string' || value !== value.trim() || value.length === 0) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString() === value ? timestamp : null;
}

function validateReadinessEvidenceEntries(evidence, required) {
  const requiredIds = new Set(required);
  const entries = new Map();

  for (const [index, item] of evidence.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`evidence[${index}] must be an object.`);
    }
    if (typeof item.id !== 'string' || item.id.length === 0 || item.id !== item.id.trim()) {
      throw new Error(`evidence[${index}].id must be a canonical non-empty string.`);
    }
    if (!requiredIds.has(item.id)) {
      throw new Error(`Unexpected release evidence id for readiness scope: ${item.id}.`);
    }
    if (entries.has(item.id)) {
      throw new Error(`Duplicate release evidence id: ${item.id}.`);
    }
    if (!EVIDENCE_STATUSES.has(item.status)) {
      throw new Error(`${item.id}.status must equal PENDING or VERIFIED.`);
    }
    entries.set(item.id, item);
  }

  return entries;
}

export function assessMarketReleaseEvidenceReadiness(manifest, { now = new Date() } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Release evidence manifest must be a JSON object.');
  }
  if (!SCOPES.has(manifest.scope)) {
    throw new Error('scope must be WEB_V1 or FULL.');
  }
  if (!Array.isArray(manifest.evidence)) {
    throw new Error('evidence must be an array.');
  }

  const required = requiredEvidenceForScope(manifest.scope);
  const entries = validateReadinessEvidenceEntries(manifest.evidence, required);

  const details = required.map((id) => {
    const item = entries.get(id);
    if (!item) return { id, state: 'MISSING' };
    if (item.status === 'PENDING') return { id, state: 'PENDING' };

    const validUntil = canonicalUtcTimestamp(item.validUntil);
    if (validUntil === null) return { id, state: 'INVALID_EXPIRY' };
    if (validUntil <= now.getTime()) return { id, state: 'EXPIRED', validUntil: item.validUntil };
    return { id, state: 'VERIFIED', validUntil: item.validUntil };
  });

  const counts = details.reduce(
    (acc, item) => {
      acc[item.state] = (acc[item.state] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const complete = details.every((item) => item.state === 'VERIFIED');

  return {
    schemaVersion: 1,
    scope: manifest.scope,
    complete,
    requiredCount: required.length,
    verifiedCount: counts.VERIFIED ?? 0,
    blockingCount: required.length - (counts.VERIFIED ?? 0),
    counts,
    evidence: details,
    proofBoundary:
      'Readiness reporting only. This report does not authenticate evidence, verify external facts, or replace check:market-ready.',
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const file = readArg('--file') ?? process.env.KNOWME_RELEASE_EVIDENCE_FILE;
  if (typeof file !== 'string' || file.trim().length === 0) {
    throw new Error('Provide --file <manifest.json> or KNOWME_RELEASE_EVIDENCE_FILE.');
  }

  const manifestJson = await readRetainedEvidenceFile(file, 'Release evidence manifest', {
    encoding: 'utf8',
    maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.manifest,
  });
  const manifest = JSON.parse(manifestJson);
  const report = assessMarketReleaseEvidenceReadiness(manifest);
  console.log(JSON.stringify(report, null, 2));
  if (!report.complete) process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Could not produce market release evidence readiness report.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';

const SCOPES = new Set(['WEB_V1', 'FULL']);

function canonicalUtcTimestamp(value) {
  if (typeof value !== 'string' || value !== value.trim() || value.length === 0) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString() === value ? timestamp : null;
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
  const entries = new Map();
  const duplicateIds = new Set();

  for (const item of manifest.evidence) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string') continue;
    const id = item.id.trim();
    if (!id) continue;
    if (entries.has(id)) duplicateIds.add(id);
    else entries.set(id, item);
  }

  const details = required.map((id) => {
    if (duplicateIds.has(id)) return { id, state: 'INVALID_DUPLICATE' };
    const item = entries.get(id);
    if (!item) return { id, state: 'MISSING' };
    if (item.status !== 'VERIFIED') return { id, state: 'PENDING' };

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

  const manifest = JSON.parse(await readFile(file, 'utf8'));
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

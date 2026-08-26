#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SCOPES = new Set(['WEB_V1', 'FULL']);

const COMMON_EVIDENCE = [
  'production_tls_domain',
  'production_deployment_smoke',
  'backup_restore_drill',
  'external_monitoring_alerting',
  'privacy_terms_legal_review',
  'data_export_delete_validation',
  'moderation_support_incident_ops',
  'antimalware_provider_validation',
];

const FULL_EVIDENCE = [
  'ios_physical_validation',
  'android_physical_validation',
  'ios_store_submission',
  'android_store_submission',
];

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalUtcTimestamp(value) {
  if (!nonEmpty(value)) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  if (new Date(timestamp).toISOString() !== value) return null;
  return timestamp;
}

export function requiredEvidenceForScope(scope) {
  return scope === 'FULL' ? [...COMMON_EVIDENCE, ...FULL_EVIDENCE] : [...COMMON_EVIDENCE];
}

export function validateMarketReleaseEvidence(manifest, { expectedCommit, now = new Date() } = {}) {
  const errors = [];
  const warnings = [];

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['Release evidence manifest must be a JSON object.'], warnings };
  }

  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must equal 1.');
  if (!SCOPES.has(manifest.scope)) errors.push('scope must be WEB_V1 or FULL.');

  const normalizedExpectedCommit = nonEmpty(expectedCommit) ? expectedCommit.trim() : '';
  if (!SHA40.test(normalizedExpectedCommit)) {
    errors.push('expected release commit must be an explicit lowercase 40-character Git commit SHA.');
  }

  if (!nonEmpty(manifest.releaseCommit) || !SHA40.test(manifest.releaseCommit.trim())) {
    errors.push('releaseCommit must be a lowercase 40-character Git commit SHA.');
  } else if (SHA40.test(normalizedExpectedCommit) && manifest.releaseCommit.trim() !== normalizedExpectedCommit) {
    errors.push('releaseCommit does not match the commit being released.');
  }

  if (!Array.isArray(manifest.evidence)) {
    errors.push('evidence must be an array.');
    return { ok: false, errors, warnings };
  }

  const byId = new Map();
  for (const item of manifest.evidence) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !nonEmpty(item.id)) {
      errors.push('Each evidence item must be an object with a non-empty id.');
      continue;
    }
    const id = item.id.trim();
    if (byId.has(id)) {
      errors.push(`Duplicate evidence id: ${id}.`);
      continue;
    }
    byId.set(id, item);
  }

  if (SCOPES.has(manifest.scope)) {
    for (const id of requiredEvidenceForScope(manifest.scope)) {
      const item = byId.get(id);
      if (!item) {
        errors.push(`Missing required release evidence: ${id}.`);
        continue;
      }
      if (item.status !== 'VERIFIED') errors.push(`${id}.status must equal VERIFIED.`);
      if (!nonEmpty(item.verifier)) errors.push(`${id}.verifier must identify the reviewer or responsible operator.`);
      if (!nonEmpty(item.evidenceRef) || item.evidenceRef.trim().length < 8) {
        errors.push(`${id}.evidenceRef must point to retained release evidence.`);
      }
      if (!nonEmpty(item.evidenceSha256) || !SHA256.test(item.evidenceSha256.trim())) {
        errors.push(`${id}.evidenceSha256 must be a lowercase 64-character SHA-256 digest.`);
      }

      const verifiedAt = canonicalUtcTimestamp(item.verifiedAt);
      if (verifiedAt === null) {
        errors.push(`${id}.verifiedAt must be a canonical ISO-8601 UTC timestamp.`);
      } else if (verifiedAt > now.getTime() + 5 * 60_000) {
        errors.push(`${id}.verifiedAt must not be in the future.`);
      }

      const validUntil = canonicalUtcTimestamp(item.validUntil);
      if (validUntil === null) {
        errors.push(`${id}.validUntil must be a canonical ISO-8601 UTC timestamp.`);
      } else {
        if (verifiedAt !== null && validUntil <= verifiedAt) {
          errors.push(`${id}.validUntil must be later than verifiedAt.`);
        }
        if (validUntil <= now.getTime()) {
          errors.push(`${id}.validUntil has expired; revalidate this release evidence.`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const file = readArg('--file') ?? process.env.KNOWME_RELEASE_EVIDENCE_FILE;
  if (!nonEmpty(file)) {
    console.error('ERROR: Provide --file <manifest.json> or KNOWME_RELEASE_EVIDENCE_FILE.');
    process.exitCode = 1;
    return;
  }

  const expectedCommit = readArg('--commit') ?? process.env.GITHUB_SHA ?? process.env.KNOWME_RELEASE_COMMIT;
  if (!nonEmpty(expectedCommit) || !SHA40.test(expectedCommit.trim())) {
    console.error(
      'ERROR: Bind market readiness to the exact release commit with --commit <sha>, GITHUB_SHA, or KNOWME_RELEASE_COMMIT.',
    );
    process.exitCode = 1;
    return;
  }

  const raw = await readFile(file, 'utf8');
  const manifest = JSON.parse(raw);
  const result = validateMarketReleaseEvidence(manifest, { expectedCommit });

  for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    console.error(`Market release evidence preflight failed with ${result.errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(`Market release evidence preflight passed for ${manifest.scope} at ${manifest.releaseCommit}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Market release evidence preflight could not read or validate the manifest.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

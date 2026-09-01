#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { createMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';
import { canonicalProductionOrigin } from './data-export-delete-smoke.mjs';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const TOP_LEVEL_FIELDS = new Set([
  'schemaVersion',
  'kind',
  'status',
  'observedAt',
  'productionOrigin',
  'canaryUserIdSha256',
  'checks',
  'proofBoundary',
]);
const CHECK_FIELDS = new Set([
  'ephemeralRegistration',
  'accountExport',
  'exportFormatVersion',
  'passwordHashExcluded',
  'accountDeletion',
  'preDeletionBearerAuthorizationRevoked',
  'deletedAccountAuthenticationRejected',
]);
const EXPECTED_PROOF_BOUNDARY =
  'This artifact proves only this ephemeral canary export/delete flow, immediate revocation of its pre-deletion bearer authorization, and rejected password login at the observed production origin; it does not prove legal compliance or deletion from provider backups outside KnowMe.';

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

export function validateDataExportDeleteSmokeArtifact(artifact, { now = new Date() } = {}) {
  const errors = [];
  if (!exactFields(artifact, TOP_LEVEL_FIELDS)) {
    return { ok: false, errors: ['Data lifecycle smoke artifact must match the exact schema-v2 field contract.'] };
  }
  if (artifact.schemaVersion !== 2) errors.push('Data lifecycle smoke schemaVersion must equal 2.');
  if (artifact.kind !== 'knowme-data-export-delete-smoke') errors.push('Data lifecycle smoke kind is invalid.');
  if (artifact.status !== 'PASSED') errors.push('Data lifecycle smoke status must equal PASSED.');

  const nowMs = now instanceof Date && Number.isFinite(now.getTime()) ? now.getTime() : NaN;
  if (!Number.isFinite(nowMs)) errors.push('now must be a valid Date.');
  const observedAt = canonicalTimestamp(artifact.observedAt);
  if (observedAt === null) errors.push('Data lifecycle smoke observedAt must be a canonical UTC timestamp.');
  else if (Number.isFinite(nowMs) && observedAt > nowMs + 5 * 60_000) errors.push('Data lifecycle smoke observedAt must not be in the future.');

  if (canonicalProductionOrigin(artifact.productionOrigin) !== artifact.productionOrigin) {
    errors.push('Data lifecycle smoke productionOrigin must be a canonical HTTPS origin.');
  }
  if (typeof artifact.canaryUserIdSha256 !== 'string' || !SHA256.test(artifact.canaryUserIdSha256)) {
    errors.push('Data lifecycle smoke canaryUserIdSha256 must be a lowercase SHA-256 digest.');
  }
  if (artifact.proofBoundary !== EXPECTED_PROOF_BOUNDARY) errors.push('Data lifecycle smoke proofBoundary is not the canonical KMD-367 boundary.');

  if (!exactFields(artifact.checks, CHECK_FIELDS)) {
    errors.push('Data lifecycle smoke checks must match the exact contract.');
  } else {
    if (artifact.checks.ephemeralRegistration !== 'PASSED') errors.push('Ephemeral registration must equal PASSED.');
    if (artifact.checks.accountExport !== 'PASSED') errors.push('Account export must equal PASSED.');
    if (!Number.isSafeInteger(artifact.checks.exportFormatVersion) || artifact.checks.exportFormatVersion < 1) {
      errors.push('Export format version must be a positive integer.');
    }
    if (artifact.checks.passwordHashExcluded !== true) errors.push('passwordHashExcluded must equal true.');
    if (artifact.checks.accountDeletion !== 'PASSED') errors.push('Account deletion must equal PASSED.');
    if (artifact.checks.preDeletionBearerAuthorizationRevoked !== true) {
      errors.push('Pre-deletion bearer authorization revocation must equal true.');
    }
    if (artifact.checks.deletedAccountAuthenticationRejected !== true) {
      errors.push('Deleted account authentication rejection must equal true.');
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, verifiedAt: artifact.observedAt };
}

export function createDataExportDeleteMarketEvidenceItem(artifactBytes, options = {}) {
  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(artifactBytes).toString('utf8'));
  } catch {
    return { ok: false, errors: ['Data lifecycle smoke artifact must contain valid JSON.'] };
  }
  const validation = validateDataExportDeleteSmokeArtifact(artifact, { now: options.now });
  if (!validation.ok) return validation;
  return createMarketReleaseEvidenceItem(artifactBytes, {
    id: 'data_export_delete_validation',
    scope: options.scope,
    verifier: options.verifier,
    evidenceRef: options.evidenceRef,
    verifiedAt: validation.verifiedAt,
    validUntil: options.validUntil,
    now: options.now,
  });
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const artifactPath = readArg('--artifact');
  const outputPath = readArg('--output');
  const scope = readArg('--scope');
  const verifier = readArg('--verifier');
  const evidenceRef = readArg('--ref');
  const validUntil = readArg('--valid-until');
  if (!artifactPath || !outputPath || !scope || !verifier || !evidenceRef || !validUntil) {
    throw new Error('Provide --artifact, --output, --scope, --verifier, --ref, and --valid-until.');
  }
  const artifactBytes = await readRetainedEvidenceFile(artifactPath, 'data export/delete retained artifact', {
    maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.artifact,
  });
  const result = createDataExportDeleteMarketEvidenceItem(artifactBytes, {
    scope,
    verifier,
    evidenceRef,
    validUntil,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));
  await writeFile(outputPath, `${JSON.stringify(result.item, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log(`Created VERIFIED data_export_delete_validation evidence item at ${outputPath}.`);
  console.log(`SHA-256: ${result.item.evidenceSha256}`);
  console.log('This item still must be applied to the unsigned release manifest, signed, bundled, retained, and pass check:market-ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Data lifecycle smoke evidence binding failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

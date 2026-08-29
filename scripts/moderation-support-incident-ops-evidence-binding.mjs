#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { createMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const TOP_FIELDS = new Set(['schemaVersion','kind','status','observedAt','environment','checks','runbookSha256','incidentRecordSha256','proofBoundary']);
const CHECK_FIELDS = new Set(['reportIntake','reportResolution','userSuspension','auditTrail','supportEscalation','incidentRunbookExercise']);
const EXPECTED_BOUNDARY = 'This artifact proves only the recorded production moderation, support, and incident-operations drill; it does not prove staffing levels, legal compliance, or future incident response performance.';

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

export function validateModerationSupportIncidentOpsArtifact(artifact, { now = new Date() } = {}) {
  const errors = [];
  if (!exactFields(artifact, TOP_FIELDS)) return { ok: false, errors: ['Moderation/support incident artifact must match the exact schema-v1 field contract.'] };
  if (artifact.schemaVersion !== 1) errors.push('schemaVersion must equal 1.');
  if (artifact.kind !== 'knowme-moderation-support-incident-ops-drill') errors.push('kind is invalid.');
  if (artifact.status !== 'PASSED') errors.push('status must equal PASSED.');
  if (artifact.environment !== 'PRODUCTION') errors.push('environment must equal PRODUCTION.');

  const observedAt = canonicalTimestamp(artifact.observedAt);
  const nowMs = now instanceof Date && Number.isFinite(now.getTime()) ? now.getTime() : NaN;
  if (observedAt === null) errors.push('observedAt must be a canonical UTC timestamp.');
  else if (Number.isFinite(nowMs) && observedAt > nowMs + 5 * 60_000) errors.push('observedAt must not be in the future.');

  if (!SHA256.test(String(artifact.runbookSha256 ?? ''))) errors.push('runbookSha256 must be a lowercase SHA-256 digest.');
  if (!SHA256.test(String(artifact.incidentRecordSha256 ?? ''))) errors.push('incidentRecordSha256 must be a lowercase SHA-256 digest.');
  if (artifact.proofBoundary !== EXPECTED_BOUNDARY) errors.push('proofBoundary is not the canonical KMD-293 boundary.');

  if (!exactFields(artifact.checks, CHECK_FIELDS)) errors.push('checks must match the exact KMD-293 contract.');
  else for (const key of CHECK_FIELDS) if (artifact.checks[key] !== 'PASSED') errors.push(`${key} must equal PASSED.`);

  return errors.length ? { ok: false, errors } : { ok: true, verifiedAt: artifact.observedAt };
}

export function createModerationSupportIncidentOpsEvidenceItem(artifactBytes, options = {}) {
  let artifact;
  try { artifact = JSON.parse(Buffer.from(artifactBytes).toString('utf8')); }
  catch { return { ok: false, errors: ['Moderation/support incident artifact must contain valid JSON.'] }; }
  const validation = validateModerationSupportIncidentOpsArtifact(artifact, { now: options.now });
  if (!validation.ok) return validation;
  return createMarketReleaseEvidenceItem(artifactBytes, {
    id: 'moderation_support_incident_ops', scope: options.scope, verifier: options.verifier,
    evidenceRef: options.evidenceRef, verifiedAt: validation.verifiedAt,
    validUntil: options.validUntil, now: options.now,
  });
}

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
async function runCli() {
  const artifact = arg('--artifact'), output = arg('--output'), scope = arg('--scope'), verifier = arg('--verifier'), evidenceRef = arg('--ref'), validUntil = arg('--valid-until');
  if (!artifact || !output || !scope || !verifier || !evidenceRef || !validUntil) throw new Error('Provide --artifact, --output, --scope, --verifier, --ref, and --valid-until.');
  const bytes = await readRetainedEvidenceFile(artifact, 'moderation/support incident retained artifact', {
    maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.artifact,
  });
  const result = createModerationSupportIncidentOpsEvidenceItem(bytes, { scope, verifier, evidenceRef, validUntil });
  if (!result.ok) throw new Error(result.errors.join(' '));
  await writeFile(output, `${JSON.stringify(result.item, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log(`Created VERIFIED moderation_support_incident_ops evidence item at ${output}.`);
  console.log(`SHA-256: ${result.item.evidenceSha256}`);
}

if (import.meta.url === `file://${process.argv[1]}`) runCli().catch((error) => { console.error('ERROR: Moderation/support incident evidence binding failed.'); console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

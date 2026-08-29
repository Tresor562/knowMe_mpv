#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { createMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const TOP_FIELDS = new Set([
  'schemaVersion',
  'kind',
  'status',
  'observedAt',
  'environment',
  'checks',
  'privacyPolicySha256',
  'termsSha256',
  'consentNoticeSha256',
  'legalReviewRecordSha256',
  'proofBoundary',
]);
const CHECK_FIELDS = new Set([
  'privacyPolicyReview',
  'termsReview',
  'consentReview',
  'dataLifecycleReview',
  'minorsAgeGateReview',
  'processorSubprocessorReview',
]);
const EXPECTED_BOUNDARY =
  'This artifact proves only that the retained production privacy, terms, consent, data-lifecycle, minors/age-gate, and processor/subprocessor materials were reviewed and recorded; it does not itself establish legal compliance, regulatory approval, or continuing validity after product or law changes.';

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

export function validatePrivacyTermsLegalReviewArtifact(artifact, { now = new Date() } = {}) {
  const errors = [];
  if (!exactFields(artifact, TOP_FIELDS)) {
    return {
      ok: false,
      errors: ['Privacy/terms legal-review artifact must match the exact schema-v1 field contract.'],
    };
  }

  if (artifact.schemaVersion !== 1) errors.push('schemaVersion must equal 1.');
  if (artifact.kind !== 'knowme-privacy-terms-legal-review') errors.push('kind is invalid.');
  if (artifact.status !== 'PASSED') errors.push('status must equal PASSED.');
  if (artifact.environment !== 'PRODUCTION') errors.push('environment must equal PRODUCTION.');

  const observedAt = canonicalTimestamp(artifact.observedAt);
  const nowMs = now instanceof Date && Number.isFinite(now.getTime()) ? now.getTime() : NaN;
  if (observedAt === null) errors.push('observedAt must be a canonical UTC timestamp.');
  else if (Number.isFinite(nowMs) && observedAt > nowMs + 5 * 60_000) {
    errors.push('observedAt must not be in the future.');
  }

  for (const field of [
    'privacyPolicySha256',
    'termsSha256',
    'consentNoticeSha256',
    'legalReviewRecordSha256',
  ]) {
    if (!SHA256.test(String(artifact[field] ?? ''))) {
      errors.push(`${field} must be a lowercase SHA-256 digest.`);
    }
  }

  if (artifact.proofBoundary !== EXPECTED_BOUNDARY) {
    errors.push('proofBoundary is not the canonical KMD-294 boundary.');
  }

  if (!exactFields(artifact.checks, CHECK_FIELDS)) {
    errors.push('checks must match the exact KMD-294 contract.');
  } else {
    for (const key of CHECK_FIELDS) {
      if (artifact.checks[key] !== 'PASSED') errors.push(`${key} must equal PASSED.`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, verifiedAt: artifact.observedAt };
}

export function createPrivacyTermsLegalReviewEvidenceItem(artifactBytes, options = {}) {
  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(artifactBytes).toString('utf8'));
  } catch {
    return { ok: false, errors: ['Privacy/terms legal-review artifact must contain valid JSON.'] };
  }

  const validation = validatePrivacyTermsLegalReviewArtifact(artifact, { now: options.now });
  if (!validation.ok) return validation;

  return createMarketReleaseEvidenceItem(artifactBytes, {
    id: 'privacy_terms_legal_review',
    scope: options.scope,
    verifier: options.verifier,
    evidenceRef: options.evidenceRef,
    verifiedAt: validation.verifiedAt,
    validUntil: options.validUntil,
    now: options.now,
  });
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const artifact = arg('--artifact');
  const output = arg('--output');
  const scope = arg('--scope');
  const verifier = arg('--verifier');
  const evidenceRef = arg('--ref');
  const validUntil = arg('--valid-until');

  if (!artifact || !output || !scope || !verifier || !evidenceRef || !validUntil) {
    throw new Error('Provide --artifact, --output, --scope, --verifier, --ref, and --valid-until.');
  }

  const bytes = await readRetainedEvidenceFile(artifact, 'privacy/terms legal-review retained artifact', {
    maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.artifact,
  });
  const result = createPrivacyTermsLegalReviewEvidenceItem(bytes, {
    scope,
    verifier,
    evidenceRef,
    validUntil,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));

  await writeFile(output, `${JSON.stringify(result.item, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Created VERIFIED privacy_terms_legal_review evidence item at ${output}.`);
  console.log(`SHA-256: ${result.item.evidenceSha256}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Privacy/terms legal-review evidence binding failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

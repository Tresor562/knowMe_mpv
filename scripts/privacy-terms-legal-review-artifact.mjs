#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

const CONFIRMATION = 'PRIVACY_LEGAL_REVIEW_COMPLETED';
const MAX_INPUT_BYTES = RETAINED_EVIDENCE_FILE_LIMITS.worksheet;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const CHECK_NAMES = [
  'privacyPolicyReview',
  'termsReview',
  'consentReview',
  'dataLifecycleReview',
  'minorsAgeGateReview',
  'processorSubprocessorReview',
];
const RECORD_FIELDS = new Set(['schemaVersion', 'kind', 'environment', 'status', 'observedAt', 'checks']);
const CHECK_FIELDS = new Set(['status', 'completedAt']);
const PROOF_BOUNDARY =
  'This artifact proves only that the retained production privacy, terms, consent, data-lifecycle, minors/age-gate, and processor/subprocessor materials were reviewed and recorded; it does not itself establish legal compliance, regulatory approval, or continuing validity after product or law changes.';

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalPath(value) {
  return nonEmpty(value) && value === value.trim() && !CONTROL_CHARACTERS.test(value) ? value : null;
}

function canonicalUtcTimestamp(value) {
  if (!nonEmpty(value) || value !== value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function exactFields(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

async function readRegularFile(path, label) {
  if (!canonicalPath(path)) throw new Error(`${label} path must be canonical and free of control characters.`);
  const bytes = await readRetainedEvidenceFile(path, label, { maxBytes: MAX_INPUT_BYTES });
  if (bytes.length < 1) {
    throw new Error(`${label} must contain between 1 and ${MAX_INPUT_BYTES} bytes.`);
  }
  return bytes;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function validatePrivacyLegalReviewRecord(record, { now = new Date() } = {}) {
  const errors = [];
  if (!exactFields(record, RECORD_FIELDS)) {
    return { ok: false, errors: ['Legal review record must match the exact KMD-296 schema-v1 contract.'] };
  }
  if (record.schemaVersion !== 1) errors.push('schemaVersion must equal 1.');
  if (record.kind !== 'knowme-privacy-terms-legal-review-record') errors.push('kind is invalid.');
  if (record.environment !== 'PRODUCTION') errors.push('environment must equal PRODUCTION.');
  if (record.status !== 'PASSED') errors.push('status must equal PASSED.');

  const observedAt = canonicalUtcTimestamp(record.observedAt);
  const nowMs = now instanceof Date && Number.isFinite(now.getTime()) ? now.getTime() : NaN;
  if (observedAt === null) errors.push('observedAt must be a canonical UTC timestamp.');
  else if (Number.isFinite(nowMs) && observedAt > nowMs + 5 * 60_000) errors.push('observedAt must not be in the future.');

  const expectedChecks = new Set(CHECK_NAMES);
  if (!exactFields(record.checks, expectedChecks)) {
    errors.push('checks must contain exactly the six KMD-296 legal/privacy checks.');
  } else {
    for (const name of CHECK_NAMES) {
      const check = record.checks[name];
      if (!exactFields(check, CHECK_FIELDS)) {
        errors.push(`${name} must contain only status and completedAt.`);
        continue;
      }
      if (check.status !== 'PASSED') errors.push(`${name}.status must equal PASSED.`);
      const completedAt = canonicalUtcTimestamp(check.completedAt);
      if (completedAt === null) errors.push(`${name}.completedAt must be canonical UTC.`);
      else {
        if (Number.isFinite(nowMs) && completedAt > nowMs + 5 * 60_000) errors.push(`${name}.completedAt must not be in the future.`);
        if (observedAt !== null && completedAt > observedAt) errors.push(`${name}.completedAt must not be later than observedAt.`);
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, observedAt: record.observedAt };
}

export async function buildPrivacyTermsLegalReviewArtifact({
  privacyPolicyPath,
  termsPath,
  consentNoticePath,
  legalReviewRecordPath,
  confirmation,
  now = new Date(),
} = {}) {
  if (confirmation !== CONFIRMATION) {
    throw new Error(`Explicit confirmation must equal ${CONFIRMATION}.`);
  }

  const [privacyPolicyBytes, termsBytes, consentNoticeBytes, legalReviewRecordBytes] = await Promise.all([
    readRegularFile(privacyPolicyPath, 'Privacy policy'),
    readRegularFile(termsPath, 'Terms'),
    readRegularFile(consentNoticePath, 'Consent notice'),
    readRegularFile(legalReviewRecordPath, 'Legal review record'),
  ]);

  let record;
  try {
    record = JSON.parse(legalReviewRecordBytes.toString('utf8'));
  } catch {
    throw new Error('Legal review record must contain valid JSON.');
  }

  const validation = validatePrivacyLegalReviewRecord(record, { now });
  if (!validation.ok) throw new Error(validation.errors.join(' '));

  return {
    schemaVersion: 1,
    kind: 'knowme-privacy-terms-legal-review',
    status: 'PASSED',
    observedAt: validation.observedAt,
    environment: 'PRODUCTION',
    checks: Object.fromEntries(CHECK_NAMES.map((name) => [name, 'PASSED'])),
    privacyPolicySha256: sha256(privacyPolicyBytes),
    termsSha256: sha256(termsBytes),
    consentNoticeSha256: sha256(consentNoticeBytes),
    legalReviewRecordSha256: sha256(legalReviewRecordBytes),
    proofBoundary: PROOF_BOUNDARY,
  };
}

export async function writePrivacyTermsLegalReviewArtifact(outputPath, artifact) {
  if (!canonicalPath(outputPath)) throw new Error('Output path must be canonical and free of control characters.');
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  let created = false;
  let handle;
  try {
    handle = await open(outputPath, 'wx', 0o600);
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    if (created) await unlink(outputPath).catch(() => {});
    throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
  return { bytes, sha256: sha256(bytes) };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const privacyPolicyPath = readArg('--privacy-policy');
  const termsPath = readArg('--terms');
  const consentNoticePath = readArg('--consent-notice');
  const legalReviewRecordPath = readArg('--legal-review-record');
  const outputPath = readArg('--output');
  const confirmation = readArg('--confirm') ?? process.env.KNOWME_PRIVACY_LEGAL_REVIEW_CONFIRM;

  if (!privacyPolicyPath || !termsPath || !consentNoticePath || !legalReviewRecordPath || !outputPath) {
    throw new Error(
      'Provide --privacy-policy <file>, --terms <file>, --consent-notice <file>, --legal-review-record <file>, and --output <artifact.json>.',
    );
  }

  const artifact = await buildPrivacyTermsLegalReviewArtifact({
    privacyPolicyPath,
    termsPath,
    consentNoticePath,
    legalReviewRecordPath,
    confirmation,
  });
  const written = await writePrivacyTermsLegalReviewArtifact(outputPath, artifact);
  console.log(`Privacy/terms legal-review artifact written to ${outputPath}.`);
  console.log(`SHA-256: ${written.sha256}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Privacy/terms legal-review artifact creation failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

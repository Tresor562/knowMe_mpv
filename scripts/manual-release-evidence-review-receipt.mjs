#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { preflightManualReleaseEvidenceWorksheet } from './manual-release-evidence-preflight.mjs';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_REVIEWER_LENGTH = 128;
const MANUAL_EVIDENCE_IDS = new Set([
  'ios_physical_validation',
  'android_physical_validation',
  'ios_store_submission',
  'android_store_submission',
]);

function canonicalReviewer(value) {
  return typeof value === 'string' &&
    value === value.trim() &&
    value.length > 0 &&
    value.length <= MAX_REVIEWER_LENGTH &&
    !CONTROL_CHARACTERS.test(value)
    ? value
    : null;
}

function canonicalTimestamp(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function canonicalWorksheetBytes(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value).toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createManualEvidenceReviewReceipt(
  worksheet,
  artifactBytes,
  { id, reviewer, reviewedAt, worksheetBytes, now = new Date() } = {},
) {
  const errors = [];
  const preflight = preflightManualReleaseEvidenceWorksheet(worksheet, { now });
  if (!preflight.ok) {
    return { ok: false, errors: preflight.errors.map((error) => `worksheet: ${error}`) };
  }

  if (!Buffer.isBuffer(artifactBytes) && !(artifactBytes instanceof Uint8Array)) {
    errors.push('artifactBytes must be a Buffer or Uint8Array.');
  }

  const parsedWorksheetBytes = canonicalWorksheetBytes(worksheetBytes);
  if (parsedWorksheetBytes === null) {
    errors.push('worksheetBytes must contain the exact UTF-8 JSON worksheet bytes reviewed by the human reviewer.');
  } else if (JSON.stringify(parsedWorksheetBytes) !== JSON.stringify(worksheet)) {
    errors.push('worksheetBytes must decode to the exact worksheet object that passed preflight.');
  }

  if (typeof id !== 'string' || !MANUAL_EVIDENCE_IDS.has(id)) {
    errors.push('id must be one of the canonical manual FULL-release evidence ids.');
  }
  if (canonicalReviewer(reviewer) === null) {
    errors.push(`reviewer must be canonical, non-empty, free of control characters, and at most ${MAX_REVIEWER_LENGTH} characters.`);
  }

  const reviewedAtMs = canonicalTimestamp(reviewedAt);
  const nowMs = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : NaN;
  if (!Number.isFinite(nowMs)) errors.push('now must be a valid Date.');
  if (reviewedAtMs === null) errors.push('reviewedAt must be a canonical UTC timestamp.');
  else if (Number.isFinite(nowMs) && reviewedAtMs > nowMs + 5 * 60_000) errors.push('reviewedAt must not be in the future.');

  const entry = Array.isArray(worksheet?.evidence) ? worksheet.evidence.find((candidate) => candidate?.id === id) : null;
  if (!entry) errors.push('worksheet does not contain the selected manual evidence id.');

  let artifactSha256 = null;
  if (Buffer.isBuffer(artifactBytes) || artifactBytes instanceof Uint8Array) {
    artifactSha256 = createHash('sha256').update(artifactBytes).digest('hex');
  }
  if (entry && artifactSha256 !== entry.retainedProof?.sha256) {
    errors.push('artifact SHA-256 does not match the worksheet retainedProof.sha256.');
  }

  if (entry && entry.retainedProof?.uri === undefined) {
    errors.push('selected worksheet entry must retain its proof URI.');
  }

  if (errors.length > 0) return { ok: false, errors };

  const worksheetSha256 = createHash('sha256').update(worksheetBytes).digest('hex');

  return {
    ok: true,
    receipt: {
      schemaVersion: 2,
      receiptType: 'MANUAL_RELEASE_EVIDENCE_HUMAN_REVIEW',
      reviewDecision: 'APPROVED_FOR_EVIDENCE_PIPELINE',
      certifiesExternalValidation: false,
      generatedForScope: 'FULL',
      environment: 'PRODUCTION',
      releaseCommit: worksheet.releaseCommit,
      releaseVersion: worksheet.releaseVersion,
      evidenceId: id,
      reviewer,
      reviewedAt,
      reviewedWorksheet: {
        sha256: worksheetSha256,
      },
      retainedProof: {
        uri: entry.retainedProof.uri,
        sha256: artifactSha256,
      },
      validationOccurredAt: entry.validation.occurredAt,
      accountableActorOrRole: entry.validation.accountableActorOrRole,
      attestationCount: entry.attestations.length,
    },
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const worksheetPath = readArg('--worksheet');
  const artifactPath = readArg('--artifact');
  const outputPath = readArg('--output');
  const id = readArg('--id');
  const reviewer = readArg('--reviewer');
  const reviewedAt = readArg('--reviewed-at');

  if (!worksheetPath || !artifactPath || !outputPath || !id || !reviewer || !reviewedAt) {
    throw new Error('Provide --worksheet, --artifact, --output, --id, --reviewer, and --reviewed-at.');
  }

  const [worksheetBytes, artifactBytes] = await Promise.all([
    readFile(worksheetPath),
    readFile(artifactPath),
  ]);
  const worksheet = JSON.parse(worksheetBytes.toString('utf8'));
  const result = createManualEvidenceReviewReceipt(worksheet, artifactBytes, {
    id,
    reviewer,
    reviewedAt,
    worksheetBytes,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));

  await writeFile(outputPath, `${JSON.stringify(result.receipt, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Created human-review receipt for ${id} at ${outputPath}.`);
  console.log(`Reviewed worksheet SHA-256: ${result.receipt.reviewedWorksheet.sha256}`);
  console.log('This receipt records review traceability only; it does not prove the external validation or create VERIFIED market evidence.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Manual release evidence review receipt creation failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

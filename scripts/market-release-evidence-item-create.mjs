#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_VERIFIER_LENGTH = 128;
const MIN_EVIDENCE_REF_LENGTH = 8;
const MAX_EVIDENCE_REF_LENGTH = 2048;
const ALLOWED_EVIDENCE_PROTOCOLS = new Set(['https:', 'evidence:']);

const SEMANTICALLY_BOUND_EVIDENCE_IDS = new Set([
  'production_tls_domain',
  'production_deployment_smoke',
  'backup_restore_drill',
  'external_monitoring_alerting',
  'privacy_terms_legal_review',
  'data_export_delete_validation',
  'moderation_support_incident_ops',
  'antimalware_provider_validation',
]);

const GENERIC_EXTERNAL_EVIDENCE_IDS = new Set([
  'ios_physical_validation',
  'android_physical_validation',
  'ios_store_submission',
  'android_store_submission',
]);

function canonicalTimestamp(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function canonicalVerifier(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  if (value.length < 1 || value.length > MAX_VERIFIER_LENGTH || CONTROL_CHARACTERS.test(value)) return null;
  return value;
}

function canonicalEvidenceRef(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  if (
    value.length < MIN_EVIDENCE_REF_LENGTH ||
    value.length > MAX_EVIDENCE_REF_LENGTH ||
    CONTROL_CHARACTERS.test(value)
  ) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (!ALLOWED_EVIDENCE_PROTOCOLS.has(parsed.protocol)) return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.hostname) return null;
  } catch {
    return null;
  }

  return value;
}

function validateManualReviewReceipt(reviewReceipt, artifactBytes, options = {}) {
  const { id, verifier, evidenceRef, worksheetBytes, expectedCommit, expectedVersion } = options;
  const errors = [];

  if (!reviewReceipt || typeof reviewReceipt !== 'object' || Array.isArray(reviewReceipt)) {
    return { ok: false, errors: ['reviewReceipt must be a parsed KMD-309 manual evidence review receipt.'] };
  }

  if (!SHA40.test(expectedCommit ?? '')) {
    errors.push('expectedCommit must be a canonical lowercase 40-character Git commit for manual evidence promotion.');
  }
  if (!RELEASE_VERSION.test(expectedVersion ?? '')) {
    errors.push('expectedVersion must be canonical SemVer without build metadata for manual evidence promotion.');
  }

  if (reviewReceipt.schemaVersion !== 2) errors.push('reviewReceipt.schemaVersion must be 2.');
  if (reviewReceipt.receiptType !== 'MANUAL_RELEASE_EVIDENCE_HUMAN_REVIEW') {
    errors.push('reviewReceipt.receiptType is invalid.');
  }
  if (reviewReceipt.reviewDecision !== 'APPROVED_FOR_EVIDENCE_PIPELINE') {
    errors.push('reviewReceipt.reviewDecision must approve evidence pipeline promotion.');
  }
  if (reviewReceipt.certifiesExternalValidation !== false) {
    errors.push('reviewReceipt must preserve certifiesExternalValidation=false.');
  }
  if (reviewReceipt.generatedForScope !== 'FULL' || reviewReceipt.environment !== 'PRODUCTION') {
    errors.push('reviewReceipt must be bound to FULL / PRODUCTION.');
  }
  if (reviewReceipt.evidenceId !== id) errors.push('reviewReceipt.evidenceId must match the requested evidence id.');
  if (canonicalVerifier(reviewReceipt.reviewer) === null) errors.push('reviewReceipt.reviewer must be canonical.');
  if (reviewReceipt.reviewer !== verifier) {
    errors.push('verifier must exactly match the human reviewer recorded by the review receipt.');
  }
  if (canonicalTimestamp(reviewReceipt.reviewedAt) === null) errors.push('reviewReceipt.reviewedAt must be canonical UTC.');
  if (canonicalTimestamp(reviewReceipt.validationOccurredAt) === null) {
    errors.push('reviewReceipt.validationOccurredAt must be canonical UTC.');
  }
  if (canonicalVerifier(reviewReceipt.accountableActorOrRole) === null) {
    errors.push('reviewReceipt.accountableActorOrRole must be canonical.');
  }
  if (!Number.isInteger(reviewReceipt.attestationCount) || reviewReceipt.attestationCount <= 0) {
    errors.push('reviewReceipt.attestationCount must be a positive integer.');
  }
  if (typeof reviewReceipt.releaseCommit !== 'string' || !SHA40.test(reviewReceipt.releaseCommit)) {
    errors.push('reviewReceipt.releaseCommit must be a canonical lowercase 40-character Git commit.');
  } else if (SHA40.test(expectedCommit ?? '') && reviewReceipt.releaseCommit !== expectedCommit) {
    errors.push('reviewReceipt.releaseCommit must exactly match the target release commit.');
  }
  if (
    typeof reviewReceipt.releaseVersion !== 'string' ||
    !RELEASE_VERSION.test(reviewReceipt.releaseVersion)
  ) {
    errors.push('reviewReceipt.releaseVersion must be canonical SemVer without build metadata.');
  } else if (RELEASE_VERSION.test(expectedVersion ?? '') && reviewReceipt.releaseVersion !== expectedVersion) {
    errors.push('reviewReceipt.releaseVersion must exactly match the target release version.');
  }

  const reviewedWorksheet = reviewReceipt.reviewedWorksheet;
  if (!reviewedWorksheet || typeof reviewedWorksheet !== 'object' || Array.isArray(reviewedWorksheet)) {
    errors.push('reviewReceipt.reviewedWorksheet must be present.');
  } else if (!SHA256.test(reviewedWorksheet.sha256 ?? '')) {
    errors.push('reviewReceipt.reviewedWorksheet.sha256 must be a canonical lowercase SHA-256.');
  }

  if (!Buffer.isBuffer(worksheetBytes) && !(worksheetBytes instanceof Uint8Array)) {
    errors.push('worksheetBytes must contain the exact worksheet bytes reviewed by KMD-309.');
  } else if (reviewedWorksheet && SHA256.test(reviewedWorksheet.sha256 ?? '')) {
    const worksheetSha256 = createHash('sha256').update(worksheetBytes).digest('hex');
    if (worksheetSha256 !== reviewedWorksheet.sha256) {
      errors.push('worksheet SHA-256 must exactly match the worksheet reviewed by KMD-309.');
    }
  }

  const retainedProof = reviewReceipt.retainedProof;
  if (!retainedProof || typeof retainedProof !== 'object' || Array.isArray(retainedProof)) {
    errors.push('reviewReceipt.retainedProof must be present.');
  } else {
    if (retainedProof.uri !== evidenceRef || canonicalEvidenceRef(retainedProof.uri) === null) {
      errors.push('evidenceRef must exactly match the canonical retained-proof URI reviewed by KMD-309.');
    }
    const artifactSha256 =
      Buffer.isBuffer(artifactBytes) || artifactBytes instanceof Uint8Array
        ? createHash('sha256').update(artifactBytes).digest('hex')
        : null;
    if (!SHA256.test(retainedProof.sha256 ?? '') || retainedProof.sha256 !== artifactSha256) {
      errors.push('artifact SHA-256 must exactly match the retained proof reviewed by KMD-309.');
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

// Low-level item constructor used by the dedicated semantic binders after they have
// validated the retained artifact contract. Operator-facing generic creation must
// use createGenericMarketReleaseEvidenceItem() below.
export function createMarketReleaseEvidenceItem(
  artifactBytes,
  {
    id,
    scope,
    verifier,
    evidenceRef,
    verifiedAt,
    validUntil,
    now = new Date(),
  } = {},
) {
  const errors = [];
  if (!Buffer.isBuffer(artifactBytes) && !(artifactBytes instanceof Uint8Array)) {
    errors.push('artifactBytes must be a Buffer or Uint8Array.');
  }

  if (scope !== 'WEB_V1' && scope !== 'FULL') {
    errors.push('scope must be WEB_V1 or FULL.');
  }
  const allowedIds = scope === 'WEB_V1' || scope === 'FULL' ? requiredEvidenceForScope(scope) : [];
  if (typeof id !== 'string' || !allowedIds.includes(id)) {
    errors.push('id must be required by the selected market release scope.');
  }
  if (canonicalVerifier(verifier) === null) {
    errors.push(`verifier must be canonical, non-empty, free of control characters, and at most ${MAX_VERIFIER_LENGTH} characters.`);
  }
  if (canonicalEvidenceRef(evidenceRef) === null) {
    errors.push('evidenceRef must be a canonical credential-free HTTPS or evidence URI without query, fragment, or control characters.');
  }

  const verifiedAtMs = canonicalTimestamp(verifiedAt);
  const validUntilMs = canonicalTimestamp(validUntil);
  const nowMs = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : NaN;
  if (!Number.isFinite(nowMs)) errors.push('now must be a valid Date.');
  if (verifiedAtMs === null) errors.push('verifiedAt must be a canonical UTC timestamp.');
  else if (Number.isFinite(nowMs) && verifiedAtMs > nowMs + 5 * 60_000) errors.push('verifiedAt must not be in the future.');
  if (validUntilMs === null) errors.push('validUntil must be a canonical UTC timestamp.');
  else {
    if (verifiedAtMs !== null && validUntilMs <= verifiedAtMs) errors.push('validUntil must be later than verifiedAt.');
    if (Number.isFinite(nowMs) && validUntilMs <= nowMs) errors.push('validUntil must still be in the future.');
  }

  if (errors.length > 0) return { ok: false, errors };

  const evidenceSha256 = createHash('sha256').update(artifactBytes).digest('hex');
  if (!SHA256.test(evidenceSha256)) return { ok: false, errors: ['Failed to compute canonical SHA-256 evidence digest.'] };

  return {
    ok: true,
    item: {
      id,
      status: 'VERIFIED',
      verifiedAt,
      validUntil,
      verifier,
      evidenceRef,
      evidenceSha256,
    },
  };
}

export function createGenericMarketReleaseEvidenceItem(artifactBytes, options = {}) {
  const { id, scope, reviewReceipt, expectedCommit, expectedVersion } = options;
  const errors = [];

  if (typeof id === 'string' && SEMANTICALLY_BOUND_EVIDENCE_IDS.has(id)) {
    errors.push(
      `${id} must be created through its dedicated semantic evidence binder; generic VERIFIED item creation is disabled for this criterion.`,
    );
  }

  if (typeof id === 'string' && !GENERIC_EXTERNAL_EVIDENCE_IDS.has(id)) {
    errors.push('Generic evidence item creation is limited to FULL-scope physical-device and store-submission evidence.');
  }

  if (scope !== 'FULL') {
    errors.push('Generic evidence item creation requires scope FULL.');
  }

  if (errors.length === 0) {
    const receiptValidation = validateManualReviewReceipt(reviewReceipt, artifactBytes, options);
    if (!receiptValidation.ok) errors.push(...receiptValidation.errors);
  }

  if (errors.length > 0) return { ok: false, errors };
  const created = createMarketReleaseEvidenceItem(artifactBytes, options);
  if (!created.ok) return created;

  // KMD-311: keep the release binding on the serialized manual evidence item itself.
  // Without these fields, an item that was correctly created for release A could be
  // replayed later into release B after the review receipt and worksheet are no longer
  // present at the apply step.
  return {
    ok: true,
    item: {
      ...created.item,
      releaseCommit: expectedCommit,
      releaseVersion: expectedVersion,
    },
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const artifactPath = readArg('--artifact');
  const worksheetPath = readArg('--worksheet');
  const reviewReceiptPath = readArg('--review-receipt');
  const outputPath = readArg('--output');
  const id = readArg('--id');
  const scope = readArg('--scope');
  const verifier = readArg('--verifier');
  const evidenceRef = readArg('--ref');
  const verifiedAt = readArg('--verified-at');
  const validUntil = readArg('--valid-until');
  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;

  if (!artifactPath || !worksheetPath || !reviewReceiptPath || !outputPath || !id || !scope || !verifier || !evidenceRef || !verifiedAt || !validUntil || !expectedCommit || !expectedVersion) {
    throw new Error('Provide --artifact, --worksheet, --review-receipt, --output, --id, --scope, --verifier, --ref, --verified-at, --valid-until, --commit, and --version (release metadata may also come from canonical environment variables).');
  }

  const [artifactBytes, worksheetBytes, reviewReceiptRaw] = await Promise.all([
    readFile(artifactPath),
    readFile(worksheetPath),
    readFile(reviewReceiptPath, 'utf8'),
  ]);
  const reviewReceipt = JSON.parse(reviewReceiptRaw);
  const result = createGenericMarketReleaseEvidenceItem(artifactBytes, {
    id,
    scope,
    verifier,
    evidenceRef,
    verifiedAt,
    validUntil,
    worksheetBytes,
    reviewReceipt,
    expectedCommit,
    expectedVersion,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));

  await writeFile(outputPath, `${JSON.stringify(result.item, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Created VERIFIED ${id} evidence item at ${outputPath}.`);
  console.log(`SHA-256: ${result.item.evidenceSha256}`);
  console.log(`Release binding: ${expectedCommit} / ${expectedVersion}`);
  console.log('Promotion required a KMD-309 human-review receipt plus the exact reviewed worksheet and retained proof bytes, all bound to the target release.');
  console.log('This item still must be applied to the unsigned release manifest, signed, and pass check:market-ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Release evidence item creation failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

#!/usr/bin/env node

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SIGNING_KEY_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const SCOPES = new Set(['WEB_V1', 'FULL']);
const ALLOWED_EVIDENCE_PROTOCOLS = new Set(['https:', 'evidence:']);
const MIN_SIGNING_KEY_LENGTH = 32;
const MAX_VERIFIER_LENGTH = 128;
const MIN_EVIDENCE_REF_LENGTH = 8;
const MAX_EVIDENCE_REF_LENGTH = 2048;
const MANIFEST_FIELDS = new Set([
  'schemaVersion',
  'scope',
  'environment',
  'releaseCommit',
  'releaseVersion',
  'signingKeyId',
  'evidence',
  'manifestHmacSha256',
]);
const EVIDENCE_FIELDS = new Set([
  'id',
  'status',
  'verifiedAt',
  'validUntil',
  'verifier',
  'evidenceRef',
  'evidenceSha256',
]);

const COMMON_EVIDENCE = [
  'production_tls_domain',
  'production_deployment_smoke',
  'backup_restore_drill',
  'external_monitoring_alerting',
  'privacy_terms_legal_review',
  'data_export_delete_validation',
  'moderation_support_incident_ops',
  'antimalware_provider_validation',
  'object_storage_provider_validation',
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

function canonicalReleaseVersion(value) {
  return typeof value === 'string' && value === value.trim() && RELEASE_VERSION.test(value) ? value : null;
}

function canonicalSigningKeyId(value) {
  return typeof value === 'string' && value === value.trim() && SIGNING_KEY_ID.test(value) ? value : null;
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
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (!parsed.hostname) return null;
  } catch {
    return null;
  }

  return value;
}

function validSigningKey(value) {
  return typeof value === 'string' && value === value.trim() && value.length >= MIN_SIGNING_KEY_LENGTH;
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`;
}

function unsignedManifest(manifest) {
  const { manifestHmacSha256: _signature, ...unsigned } = manifest;
  return unsigned;
}

function unknownFields(value, allowed) {
  return Object.keys(value).filter((key) => !allowed.has(key));
}

export function computeMarketReleaseEvidenceHmac(manifest, signingKey) {
  if (!validSigningKey(signingKey)) {
    throw new Error(`Release evidence signing key must be at least ${MIN_SIGNING_KEY_LENGTH} canonical characters.`);
  }
  return createHmac('sha256', signingKey).update(canonicalJson(unsignedManifest(manifest)), 'utf8').digest('hex');
}

function signatureMatches(manifest, signingKey) {
  if (!nonEmpty(manifest.manifestHmacSha256) || !SHA256.test(manifest.manifestHmacSha256)) return false;
  const expected = computeMarketReleaseEvidenceHmac(manifest, signingKey);
  const actualBuffer = Buffer.from(manifest.manifestHmacSha256, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function requiredEvidenceForScope(scope) {
  return scope === 'FULL' ? [...COMMON_EVIDENCE, ...FULL_EVIDENCE] : [...COMMON_EVIDENCE];
}

export function validateMarketReleaseEvidence(
  manifest,
  { expectedCommit, expectedReleaseVersion, expectedSigningKeyId, signingKey, now = new Date() } = {},
) {
  const errors = [];
  const warnings = [];

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['Release evidence manifest must be a JSON object.'], warnings };
  }

  const unknownManifestFields = unknownFields(manifest, MANIFEST_FIELDS);
  if (unknownManifestFields.length > 0) {
    errors.push(`Unknown release evidence manifest field(s): ${unknownManifestFields.sort().join(', ')}.`);
  }

  if (manifest.schemaVersion !== 4) errors.push('schemaVersion must equal 4.');
  if (!SCOPES.has(manifest.scope)) errors.push('scope must be WEB_V1 or FULL.');
  if (manifest.environment !== 'PRODUCTION') errors.push('environment must equal PRODUCTION.');

  const normalizedExpectedSigningKeyId = canonicalSigningKeyId(expectedSigningKeyId);
  if (normalizedExpectedSigningKeyId === null) {
    errors.push('expected signing key id must be an explicit canonical identifier.');
  }
  const manifestSigningKeyId = canonicalSigningKeyId(manifest.signingKeyId);
  if (manifestSigningKeyId === null) {
    errors.push('signingKeyId must be a canonical lowercase identifier of at most 64 characters.');
  } else if (normalizedExpectedSigningKeyId !== null && manifestSigningKeyId !== normalizedExpectedSigningKeyId) {
    errors.push('signingKeyId does not match the release evidence signing key identity.');
  }

  if (!validSigningKey(signingKey)) {
    errors.push(`release evidence signing key must be an explicit canonical secret of at least ${MIN_SIGNING_KEY_LENGTH} characters.`);
  } else if (!signatureMatches(manifest, signingKey)) {
    errors.push('manifestHmacSha256 is missing, malformed, or does not authenticate this release evidence manifest.');
  }

  const normalizedExpectedCommit = nonEmpty(expectedCommit) ? expectedCommit.trim() : '';
  if (!SHA40.test(normalizedExpectedCommit)) {
    errors.push('expected release commit must be an explicit lowercase 40-character Git commit SHA.');
  }

  if (!nonEmpty(manifest.releaseCommit) || !SHA40.test(manifest.releaseCommit.trim())) {
    errors.push('releaseCommit must be a lowercase 40-character Git commit SHA.');
  } else if (SHA40.test(normalizedExpectedCommit) && manifest.releaseCommit.trim() !== normalizedExpectedCommit) {
    errors.push('releaseCommit does not match the commit being released.');
  }

  const normalizedExpectedReleaseVersion = canonicalReleaseVersion(expectedReleaseVersion);
  if (normalizedExpectedReleaseVersion === null) {
    errors.push('expected release version must be an explicit canonical SemVer version.');
  }

  const manifestReleaseVersion = canonicalReleaseVersion(manifest.releaseVersion);
  if (manifestReleaseVersion === null) {
    errors.push('releaseVersion must be a canonical SemVer version without build metadata.');
  } else if (normalizedExpectedReleaseVersion !== null && manifestReleaseVersion !== normalizedExpectedReleaseVersion) {
    errors.push('releaseVersion does not match the version being released.');
  }

  if (!Array.isArray(manifest.evidence)) {
    errors.push('evidence must be an array.');
    return { ok: false, errors, warnings };
  }

  const requiredIds = SCOPES.has(manifest.scope) ? new Set(requiredEvidenceForScope(manifest.scope)) : new Set();
  const byId = new Map();
  for (const item of manifest.evidence) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !nonEmpty(item.id)) {
      errors.push('Each evidence item must be an object with a non-empty id.');
      continue;
    }
    const id = item.id.trim();
    const unknownEvidenceFields = unknownFields(item, EVIDENCE_FIELDS);
    if (unknownEvidenceFields.length > 0) {
      errors.push(`${id} contains unknown field(s): ${unknownEvidenceFields.sort().join(', ')}.`);
    }
    if (SCOPES.has(manifest.scope) && !requiredIds.has(id)) {
      errors.push(`Unexpected release evidence id for ${manifest.scope}: ${id}.`);
    }
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
      if (canonicalVerifier(item.verifier) === null) {
        errors.push(`${id}.verifier must be canonical, non-empty, free of control characters, and at most ${MAX_VERIFIER_LENGTH} characters.`);
      }
      if (canonicalEvidenceRef(item.evidenceRef) === null) {
        errors.push(`${id}.evidenceRef must be a canonical credential-free HTTPS or evidence URI of ${MIN_EVIDENCE_REF_LENGTH}-${MAX_EVIDENCE_REF_LENGTH} characters without query, fragment, or control characters.`);
      }
      if (
        !nonEmpty(item.evidenceSha256) ||
        item.evidenceSha256 !== item.evidenceSha256.trim() ||
        !SHA256.test(item.evidenceSha256)
      ) {
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
    console.error('ERROR: Bind market readiness to the exact release commit with --commit <sha>, GITHUB_SHA, or KNOWME_RELEASE_COMMIT.');
    process.exitCode = 1;
    return;
  }

  const expectedReleaseVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  if (canonicalReleaseVersion(expectedReleaseVersion) === null) {
    console.error('ERROR: Bind market readiness to the exact release version with --version <semver> or KNOWME_RELEASE_VERSION.');
    process.exitCode = 1;
    return;
  }

  const expectedSigningKeyId = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID;
  if (canonicalSigningKeyId(expectedSigningKeyId) === null) {
    console.error('ERROR: KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID must be an explicit canonical lowercase key identifier.');
    process.exitCode = 1;
    return;
  }

  const signingKey = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY;
  if (!validSigningKey(signingKey)) {
    console.error(`ERROR: KNOWME_RELEASE_EVIDENCE_SIGNING_KEY must be an explicit canonical secret of at least ${MIN_SIGNING_KEY_LENGTH} characters.`);
    process.exitCode = 1;
    return;
  }

  const raw = await readRetainedEvidenceFile(file, 'Market release evidence manifest', {
    encoding: 'utf8',
    maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.manifest,
  });
  const manifest = JSON.parse(raw);
  const result = validateMarketReleaseEvidence(manifest, {
    expectedCommit,
    expectedReleaseVersion,
    expectedSigningKeyId,
    signingKey,
  });

  for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    console.error(`Market release evidence preflight failed with ${result.errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(`Market release evidence preflight passed for ${manifest.scope} ${manifest.releaseVersion} at ${manifest.releaseCommit} using signing key ${manifest.signingKeyId}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Market release evidence preflight could not read or validate the manifest.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

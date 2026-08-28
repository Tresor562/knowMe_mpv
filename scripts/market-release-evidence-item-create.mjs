#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
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
  const { id, scope } = options;
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

  if (errors.length > 0) return { ok: false, errors };
  return createMarketReleaseEvidenceItem(artifactBytes, options);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const artifactPath = readArg('--artifact');
  const outputPath = readArg('--output');
  const id = readArg('--id');
  const scope = readArg('--scope');
  const verifier = readArg('--verifier');
  const evidenceRef = readArg('--ref');
  const verifiedAt = readArg('--verified-at');
  const validUntil = readArg('--valid-until');

  if (!artifactPath || !outputPath || !id || !scope || !verifier || !evidenceRef || !verifiedAt || !validUntil) {
    throw new Error('Provide --artifact, --output, --id, --scope, --verifier, --ref, --verified-at, and --valid-until.');
  }

  const artifactBytes = await readFile(artifactPath);
  const result = createGenericMarketReleaseEvidenceItem(artifactBytes, {
    id,
    scope,
    verifier,
    evidenceRef,
    verifiedAt,
    validUntil,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));

  await writeFile(outputPath, `${JSON.stringify(result.item, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Created VERIFIED ${id} evidence item at ${outputPath}.`);
  console.log(`SHA-256: ${result.item.evidenceSha256}`);
  console.log('This item still must be applied to the unsigned release manifest, signed, and pass check:market-ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Release evidence item creation failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

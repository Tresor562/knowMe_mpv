#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const ZERO_HMAC = '0'.repeat(64);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ALLOWED_EVIDENCE_PROTOCOLS = new Set(['https:', 'evidence:']);
const MAX_VERIFIER_LENGTH = 128;
const MIN_EVIDENCE_REF_LENGTH = 8;
const MAX_EVIDENCE_REF_LENGTH = 2048;
const ITEM_KEYS = ['id', 'status', 'verifiedAt', 'validUntil', 'verifier', 'evidenceRef', 'evidenceSha256'];
const RELEASE_BOUND_ITEM_KEYS = [...ITEM_KEYS, 'releaseCommit', 'releaseVersion'];
const MANUAL_RELEASE_BOUND_IDS = new Set([
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
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (!parsed.hostname) return null;
  } catch {
    return null;
  }

  return value;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const sortedExpected = [...expected].sort();
  const keys = Object.keys(value).sort();
  return keys.length === sortedExpected.length && keys.every((key, index) => key === sortedExpected[index]);
}

export function applyMarketReleaseEvidenceItem(
  manifest,
  item,
  { expectedCommit, expectedVersion, now = new Date() } = {},
) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) errors.push('manifest must be a JSON object.');
  if (!item || typeof item !== 'object' || Array.isArray(item)) errors.push('item must be a JSON object.');
  if (!SHA40.test(expectedCommit ?? '')) errors.push('expectedCommit must be a lowercase 40-character Git SHA.');
  if (!RELEASE_VERSION.test(expectedVersion ?? '')) errors.push('expectedVersion must be a canonical SemVer without build metadata.');
  const nowMs = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : NaN;
  if (!Number.isFinite(nowMs)) errors.push('now must be a valid Date.');

  let allowedIds = [];
  if (manifest && typeof manifest === 'object' && !Array.isArray(manifest)) {
    if (manifest.schemaVersion !== 4) errors.push('manifest schemaVersion must be 4.');
    if (manifest.releaseCommit !== expectedCommit) errors.push('manifest releaseCommit does not match expectedCommit.');
    if (manifest.releaseVersion !== expectedVersion) errors.push('manifest releaseVersion does not match expectedVersion.');
    if (manifest.manifestHmacSha256 !== ZERO_HMAC) errors.push('manifest must be unsigned before applying an evidence item.');
    if (!Array.isArray(manifest.evidence)) errors.push('manifest evidence must be an array.');
    if (manifest.scope !== 'WEB_V1' && manifest.scope !== 'FULL') errors.push('manifest scope must be WEB_V1 or FULL.');
    else allowedIds = requiredEvidenceForScope(manifest.scope);
  }

  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const isReleaseBoundManualEvidence = MANUAL_RELEASE_BOUND_IDS.has(item.id);
    const expectedKeys = isReleaseBoundManualEvidence ? RELEASE_BOUND_ITEM_KEYS : ITEM_KEYS;
    if (!exactKeys(item, expectedKeys)) {
      errors.push(
        isReleaseBoundManualEvidence
          ? 'manual physical/store evidence item must contain exactly the bounded evidence fields plus releaseCommit and releaseVersion.'
          : 'item must contain exactly the bounded release evidence fields.',
      );
    }
    if (typeof item.id !== 'string' || !allowedIds.includes(item.id)) errors.push('item id must be required by the manifest scope.');
    if (item.status !== 'VERIFIED') errors.push('item status must be VERIFIED.');
    if (canonicalVerifier(item.verifier) === null) {
      errors.push(`item verifier must be canonical, non-empty, free of control characters, and at most ${MAX_VERIFIER_LENGTH} characters.`);
    }
    if (canonicalEvidenceRef(item.evidenceRef) === null) {
      errors.push(`item evidenceRef must be a canonical credential-free HTTPS or evidence URI of ${MIN_EVIDENCE_REF_LENGTH}-${MAX_EVIDENCE_REF_LENGTH} characters without query, fragment, or control characters.`);
    }
    if (!SHA256.test(item.evidenceSha256 ?? '')) errors.push('item evidenceSha256 must be a lowercase SHA-256 digest.');
    if (isReleaseBoundManualEvidence) {
      if (!SHA40.test(item.releaseCommit ?? '')) {
        errors.push('manual evidence item releaseCommit must be a canonical lowercase 40-character Git SHA.');
      } else if (item.releaseCommit !== expectedCommit) {
        errors.push('manual evidence item releaseCommit does not match the target release commit.');
      }
      if (!RELEASE_VERSION.test(item.releaseVersion ?? '')) {
        errors.push('manual evidence item releaseVersion must be canonical SemVer without build metadata.');
      } else if (item.releaseVersion !== expectedVersion) {
        errors.push('manual evidence item releaseVersion does not match the target release version.');
      }
    }
    const verifiedAtMs = canonicalTimestamp(item.verifiedAt);
    const validUntilMs = canonicalTimestamp(item.validUntil);
    if (verifiedAtMs === null) errors.push('item verifiedAt must be a canonical UTC timestamp.');
    if (validUntilMs === null) errors.push('item validUntil must be a canonical UTC timestamp.');
    if (verifiedAtMs !== null && Number.isFinite(nowMs) && verifiedAtMs > nowMs + 5 * 60_000) errors.push('item verifiedAt must not be in the future.');
    if (validUntilMs !== null && Number.isFinite(nowMs) && validUntilMs <= nowMs) errors.push('item validUntil must still be in the future.');
    if (verifiedAtMs !== null && validUntilMs !== null && validUntilMs <= verifiedAtMs) errors.push('item validUntil must be later than verifiedAt.');
  }

  if (errors.length === 0) {
    const matches = manifest.evidence.filter((entry) => entry?.id === item.id);
    if (matches.length !== 1) errors.push(`manifest must contain exactly one ${item.id} slot.`);
    else if (matches[0].status !== 'PENDING') errors.push(`${item.id} slot must still be PENDING before apply.`);
  }

  if (errors.length > 0) return { ok: false, errors };

  const output = structuredClone(manifest);
  const index = output.evidence.findIndex((entry) => entry.id === item.id);
  if (MANUAL_RELEASE_BOUND_IDS.has(item.id)) {
    const { releaseCommit: _releaseCommit, releaseVersion: _releaseVersion, ...manifestItem } = item;
    output.evidence[index] = structuredClone(manifestItem);
  } else {
    output.evidence[index] = structuredClone(item);
  }
  output.manifestHmacSha256 = ZERO_HMAC;
  return { ok: true, manifest: output };
}

export function applyProductionDeploymentSmokeEvidenceItem(manifest, item, options) {
  if (item?.id !== 'production_deployment_smoke') {
    return { ok: false, errors: ['item id must be production_deployment_smoke.'] };
  }
  return applyMarketReleaseEvidenceItem(manifest, item, options);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const manifestPath = readArg('--manifest');
  const itemPath = readArg('--item');
  const outputPath = readArg('--output');
  if (!manifestPath || !itemPath || !outputPath) {
    throw new Error('Provide --manifest <file>, --item <file>, and --output <file>.');
  }
  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const item = JSON.parse(await readFile(itemPath, 'utf8'));
  const result = applyMarketReleaseEvidenceItem(manifest, item, { expectedCommit, expectedVersion });
  if (!result.ok) throw new Error(result.errors.join(' '));
  await writeFile(outputPath, `${JSON.stringify(result.manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Applied ${item.id} evidence to unsigned manifest at ${outputPath}.`);
  console.log('The resulting manifest is intentionally unsigned and must still pass release:evidence:sign and check:market-ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Release evidence item apply failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

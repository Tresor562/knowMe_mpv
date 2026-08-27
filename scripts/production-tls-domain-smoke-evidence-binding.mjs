#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { createMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const TOP_LEVEL_FIELDS = new Set(['schemaVersion','kind','status','observedAt','origin','hostname','port','minValidityDays','tls','proofBoundary']);
const TLS_FIELDS = new Set(['protocol','fingerprintSha256','validFrom','validTo','remainingValidityDays']);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

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

function canonicalInteger(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

export function validateProductionTlsDomainSmokeArtifact(artifact, { now = new Date() } = {}) {
  const errors = [];
  if (!exactFields(artifact, TOP_LEVEL_FIELDS)) return { ok:false, errors:['TLS/domain smoke artifact must match the exact schema v1 field contract.'] };
  if (artifact.schemaVersion !== 1) errors.push('TLS/domain smoke schemaVersion must be 1.');
  if (artifact.kind !== 'knowme-production-tls-domain-smoke') errors.push('TLS/domain smoke kind is invalid.');
  if (artifact.status !== 'PASSED') errors.push('TLS/domain smoke status must be PASSED.');

  const observedAt = canonicalTimestamp(artifact.observedAt);
  const nowMs = now instanceof Date && Number.isFinite(now.getTime()) ? now.getTime() : NaN;
  if (!Number.isFinite(nowMs)) errors.push('now must be a valid Date.');
  if (observedAt === null) errors.push('TLS/domain smoke observedAt must be a canonical UTC timestamp.');
  else if (Number.isFinite(nowMs) && observedAt > nowMs + 5 * 60_000) errors.push('TLS/domain smoke observedAt must not be in the future.');

  let parsedOrigin;
  try { parsedOrigin = new URL(artifact.origin); } catch { parsedOrigin = null; }
  if (!parsedOrigin || parsedOrigin.protocol !== 'https:' || parsedOrigin.username || parsedOrigin.password || parsedOrigin.search || parsedOrigin.hash || parsedOrigin.pathname !== '/') {
    errors.push('TLS/domain smoke origin must be a canonical HTTPS origin.');
  } else {
    const expectedPort = parsedOrigin.port ? Number(parsedOrigin.port) : 443;
    if (artifact.hostname !== parsedOrigin.hostname) errors.push('TLS/domain smoke hostname must match the observed origin.');
    if (artifact.port !== expectedPort) errors.push('TLS/domain smoke port must match the observed origin.');
  }

  if (canonicalInteger(artifact.minValidityDays,1,365) === null) errors.push('TLS/domain smoke minimum validity policy is invalid.');
  if (!exactFields(artifact.tls, TLS_FIELDS)) {
    errors.push('TLS/domain smoke TLS result contract is invalid.');
  } else {
    if (typeof artifact.tls.protocol !== 'string' || artifact.tls.protocol.length < 1 || artifact.tls.protocol.length > 32 || CONTROL_CHARACTERS.test(artifact.tls.protocol)) errors.push('TLS protocol is invalid.');
    if (typeof artifact.tls.fingerprintSha256 !== 'string' || !SHA256.test(artifact.tls.fingerprintSha256)) errors.push('TLS certificate fingerprint SHA-256 is invalid.');
    const validFrom = canonicalTimestamp(artifact.tls.validFrom);
    const validTo = canonicalTimestamp(artifact.tls.validTo);
    if (validFrom === null || validTo === null || validTo <= validFrom) errors.push('TLS certificate validity window is invalid.');
    if (canonicalInteger(artifact.tls.remainingValidityDays,0,3650) === null) errors.push('TLS remaining validity is invalid.');
    if (validTo !== null && observedAt !== null) {
      if (observedAt < validFrom || observedAt > validTo) errors.push('TLS certificate was not valid at observation time.');
      const measuredDays = Math.floor((validTo - observedAt) / 86_400_000);
      if (artifact.tls.remainingValidityDays !== measuredDays) errors.push('TLS remaining validity does not match the retained certificate dates.');
      if (measuredDays < artifact.minValidityDays) errors.push('TLS retained observation violates its minimum-validity policy.');
    }
  }

  if (typeof artifact.proofBoundary !== 'string' || artifact.proofBoundary !== artifact.proofBoundary.trim() || artifact.proofBoundary.length < 1 || artifact.proofBoundary.length > 1024 || CONTROL_CHARACTERS.test(artifact.proofBoundary)) errors.push('TLS/domain smoke proofBoundary is invalid.');
  return errors.length ? { ok:false, errors } : { ok:true, verifiedAt: artifact.observedAt };
}

export function createProductionTlsDomainMarketEvidenceItem(artifactBytes, options = {}) {
  let artifact;
  try { artifact = JSON.parse(Buffer.from(artifactBytes).toString('utf8')); }
  catch { return { ok:false, errors:['TLS/domain smoke artifact must contain valid JSON.'] }; }
  const validation = validateProductionTlsDomainSmokeArtifact(artifact, { now: options.now });
  if (!validation.ok) return validation;
  return createMarketReleaseEvidenceItem(artifactBytes, {
    id:'production_tls_domain', scope:options.scope, verifier:options.verifier,
    evidenceRef:options.evidenceRef, verifiedAt:validation.verifiedAt,
    validUntil:options.validUntil, now:options.now,
  });
}

function readArg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i+1] : undefined; }
async function runCli() {
  const artifactPath=readArg('--artifact'), outputPath=readArg('--output'), scope=readArg('--scope'), verifier=readArg('--verifier'), evidenceRef=readArg('--ref'), validUntil=readArg('--valid-until');
  if (!artifactPath || !outputPath || !scope || !verifier || !evidenceRef || !validUntil) throw new Error('Provide --artifact, --output, --scope, --verifier, --ref, and --valid-until.');
  const bytes = await readFile(artifactPath);
  const result = createProductionTlsDomainMarketEvidenceItem(bytes,{scope,verifier,evidenceRef,validUntil});
  if (!result.ok) throw new Error(result.errors.join(' '));
  await writeFile(outputPath, `${JSON.stringify(result.item,null,2)}\n`, {encoding:'utf8',flag:'wx',mode:0o600});
  console.log(`Created VERIFIED production_tls_domain evidence item at ${outputPath}.`);
  console.log(`SHA-256: ${result.item.evidenceSha256}`);
}

if (import.meta.url === `file://${process.argv[1]}`) runCli().catch((error)=>{ console.error('ERROR: TLS/domain smoke evidence binding failed.'); console.error(error instanceof Error ? error.message : String(error)); process.exitCode=1; });

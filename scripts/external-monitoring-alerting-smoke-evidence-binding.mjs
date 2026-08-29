#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { createMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';
import { canonicalProductionOrigin } from './external-monitoring-alerting-smoke.mjs';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const TOP_LEVEL_FIELDS = new Set([
  'schemaVersion',
  'kind',
  'status',
  'observedAt',
  'productionOrigin',
  'evidenceEndpointSha256',
  'providerName',
  'monitorIdHash',
  'monitoring',
  'alerting',
  'policy',
]);
const MONITORING_FIELDS = new Set(['state', 'lastCheckedAt']);
const ALERTING_FIELDS = new Set(['enabled', 'lastTestAt', 'lastTestStatus']);
const POLICY_FIELDS = new Set(['maxObservationAgeSeconds', 'maxAlertTestAgeHours']);
const MIN_OBSERVATION_AGE_SECONDS = 60;
const MAX_OBSERVATION_AGE_SECONDS = 3600;
const MIN_ALERT_TEST_AGE_HOURS = 1;
const MAX_ALERT_TEST_AGE_HOURS = 168;

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

function canonicalProviderName(value) {
  return typeof value === 'string' && value === value.trim() && value.length >= 1 && value.length <= 64 && !CONTROL_CHARACTERS.test(value)
    ? value
    : null;
}

export function validateExternalMonitoringAlertingSmokeArtifact(artifact, { now = new Date() } = {}) {
  const errors = [];
  if (!exactFields(artifact, TOP_LEVEL_FIELDS)) {
    return { ok: false, errors: ['External monitoring smoke artifact must match the exact schema-v1 field contract.'] };
  }

  if (artifact.schemaVersion !== 1) errors.push('External monitoring smoke schemaVersion must equal 1.');
  if (artifact.kind !== 'knowme-external-monitoring-alerting-smoke') errors.push('External monitoring smoke kind is invalid.');
  if (artifact.status !== 'PASSED') errors.push('External monitoring smoke status must equal PASSED.');

  const nowMs = now instanceof Date && Number.isFinite(now.getTime()) ? now.getTime() : NaN;
  if (!Number.isFinite(nowMs)) errors.push('now must be a valid Date.');
  const observedAt = canonicalTimestamp(artifact.observedAt);
  if (observedAt === null) errors.push('External monitoring smoke observedAt must be a canonical UTC timestamp.');
  else if (Number.isFinite(nowMs) && observedAt > nowMs + 5 * 60_000) errors.push('External monitoring smoke observedAt must not be in the future.');

  if (canonicalProductionOrigin(artifact.productionOrigin) !== artifact.productionOrigin) {
    errors.push('External monitoring smoke productionOrigin must be a canonical HTTPS origin.');
  }
  if (typeof artifact.evidenceEndpointSha256 !== 'string' || !SHA256.test(artifact.evidenceEndpointSha256)) {
    errors.push('External monitoring evidence endpoint SHA-256 is invalid.');
  }
  if (canonicalProviderName(artifact.providerName) === null) errors.push('External monitoring providerName must be canonical and bounded.');
  if (typeof artifact.monitorIdHash !== 'string' || !SHA256.test(artifact.monitorIdHash)) {
    errors.push('External monitoring monitorIdHash must be a lowercase SHA-256 digest.');
  }

  let monitorCheckedAt = null;
  if (!exactFields(artifact.monitoring, MONITORING_FIELDS)) {
    errors.push('External monitoring state must match the exact contract.');
  } else {
    if (artifact.monitoring.state !== 'UP') errors.push('External monitoring state must equal UP.');
    monitorCheckedAt = canonicalTimestamp(artifact.monitoring.lastCheckedAt);
    if (monitorCheckedAt === null) errors.push('External monitoring lastCheckedAt must be a canonical UTC timestamp.');
  }

  let alertTestedAt = null;
  if (!exactFields(artifact.alerting, ALERTING_FIELDS)) {
    errors.push('External alerting state must match the exact contract.');
  } else {
    if (artifact.alerting.enabled !== true) errors.push('External alerting must be enabled.');
    if (artifact.alerting.lastTestStatus !== 'DELIVERED') errors.push('External alerting lastTestStatus must equal DELIVERED.');
    alertTestedAt = canonicalTimestamp(artifact.alerting.lastTestAt);
    if (alertTestedAt === null) errors.push('External alerting lastTestAt must be a canonical UTC timestamp.');
  }

  if (!exactFields(artifact.policy, POLICY_FIELDS)) {
    errors.push('External monitoring policy must match the exact contract.');
  } else {
    if (!Number.isSafeInteger(artifact.policy.maxObservationAgeSeconds) || artifact.policy.maxObservationAgeSeconds < MIN_OBSERVATION_AGE_SECONDS || artifact.policy.maxObservationAgeSeconds > MAX_OBSERVATION_AGE_SECONDS) {
      errors.push('External monitoring maxObservationAgeSeconds is outside the supported policy bounds.');
    }
    if (!Number.isSafeInteger(artifact.policy.maxAlertTestAgeHours) || artifact.policy.maxAlertTestAgeHours < MIN_ALERT_TEST_AGE_HOURS || artifact.policy.maxAlertTestAgeHours > MAX_ALERT_TEST_AGE_HOURS) {
      errors.push('External monitoring maxAlertTestAgeHours is outside the supported policy bounds.');
    }
  }

  if (observedAt !== null && monitorCheckedAt !== null && Number.isSafeInteger(artifact.policy?.maxObservationAgeSeconds)) {
    const ageMs = observedAt - monitorCheckedAt;
    if (ageMs < -5 * 60_000) errors.push('External monitoring lastCheckedAt must not be later than the smoke observation.');
    if (ageMs > artifact.policy.maxObservationAgeSeconds * 1000) errors.push('External monitor observation exceeds the retained freshness policy.');
  }
  if (observedAt !== null && alertTestedAt !== null && Number.isSafeInteger(artifact.policy?.maxAlertTestAgeHours)) {
    const ageMs = observedAt - alertTestedAt;
    if (ageMs < -5 * 60_000) errors.push('External alert test must not be later than the smoke observation.');
    if (ageMs > artifact.policy.maxAlertTestAgeHours * 3_600_000) errors.push('External alert test exceeds the retained freshness policy.');
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, verifiedAt: artifact.observedAt };
}

export function createExternalMonitoringAlertingMarketEvidenceItem(artifactBytes, options = {}) {
  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(artifactBytes).toString('utf8'));
  } catch {
    return { ok: false, errors: ['External monitoring smoke artifact must contain valid JSON.'] };
  }

  const validation = validateExternalMonitoringAlertingSmokeArtifact(artifact, { now: options.now });
  if (!validation.ok) return validation;

  return createMarketReleaseEvidenceItem(artifactBytes, {
    id: 'external_monitoring_alerting',
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

  const artifactBytes = await readRetainedEvidenceFile(artifactPath, 'external monitoring/alerting retained artifact', {
    maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.artifact,
  });
  const result = createExternalMonitoringAlertingMarketEvidenceItem(artifactBytes, {
    scope,
    verifier,
    evidenceRef,
    validUntil,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));

  await writeFile(outputPath, `${JSON.stringify(result.item, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Created VERIFIED external_monitoring_alerting evidence item at ${outputPath}.`);
  console.log(`SHA-256: ${result.item.evidenceSha256}`);
  console.log('This item still must be applied to the unsigned release manifest, signed, bundled, retained, and pass check:market-ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: External monitoring smoke evidence binding failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

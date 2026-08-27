#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';

const MIN_TOKEN_LENGTH = 32;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 5_000;
const MIN_OBSERVATION_AGE_SECONDS = 60;
const MAX_OBSERVATION_AGE_SECONDS = 3_600;
const DEFAULT_OBSERVATION_AGE_SECONDS = 900;
const MIN_ALERT_TEST_AGE_HOURS = 1;
const MAX_ALERT_TEST_AGE_HOURS = 168;
const DEFAULT_ALERT_TEST_AGE_HOURS = 24;
const MAX_RESPONSE_BYTES = 64 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const TOP_LEVEL_FIELDS = new Set(['schemaVersion', 'kind', 'productionOrigin', 'status', 'monitoring', 'alerting', 'provider']);
const MONITORING_FIELDS = new Set(['state', 'lastCheckedAt']);
const ALERTING_FIELDS = new Set(['enabled', 'lastTestAt', 'lastTestStatus']);
const PROVIDER_FIELDS = new Set(['name', 'monitorIdHash']);

function canonicalPositiveInteger(value, min, max, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || value !== value.trim() || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function canonicalProductionOrigin(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (!url.hostname || (url.pathname !== '/' && url.pathname !== '')) return null;
    url.pathname = '/';
    return url.toString();
  } catch {
    return null;
  }
}

export function canonicalMonitoringEvidenceUrl(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function canonicalUtcTimestamp(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? timestamp : null;
}

function exactFields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function canonicalProviderName(value) {
  return typeof value === 'string' && value === value.trim() && value.length >= 1 && value.length <= 64 && !CONTROL_CHARACTERS.test(value)
    ? value
    : null;
}

export function validateMonitoringAttestation(
  payload,
  {
    productionOrigin,
    now = new Date(),
    maxObservationAgeSeconds = DEFAULT_OBSERVATION_AGE_SECONDS,
    maxAlertTestAgeHours = DEFAULT_ALERT_TEST_AGE_HOURS,
  } = {},
) {
  const errors = [];
  const normalizedOrigin = canonicalProductionOrigin(productionOrigin);
  if (normalizedOrigin === null) errors.push('Expected production origin must be a canonical HTTPS origin.');
  if (!Number.isSafeInteger(maxObservationAgeSeconds) || maxObservationAgeSeconds < MIN_OBSERVATION_AGE_SECONDS || maxObservationAgeSeconds > MAX_OBSERVATION_AGE_SECONDS) {
    errors.push(`Monitoring observation age must be between ${MIN_OBSERVATION_AGE_SECONDS} and ${MAX_OBSERVATION_AGE_SECONDS} seconds.`);
  }
  if (!Number.isSafeInteger(maxAlertTestAgeHours) || maxAlertTestAgeHours < MIN_ALERT_TEST_AGE_HOURS || maxAlertTestAgeHours > MAX_ALERT_TEST_AGE_HOURS) {
    errors.push(`Alert-test age must be between ${MIN_ALERT_TEST_AGE_HOURS} and ${MAX_ALERT_TEST_AGE_HOURS} hours.`);
  }
  if (!exactFields(payload, TOP_LEVEL_FIELDS)) return { ok: false, errors: [...errors, 'Monitoring attestation must use the exact schema-v1 top-level contract.'] };
  if (payload.schemaVersion !== 1) errors.push('Monitoring attestation schemaVersion must equal 1.');
  if (payload.kind !== 'knowme-external-monitoring-alerting-attestation') errors.push('Monitoring attestation kind is invalid.');
  if (payload.status !== 'PASSING') errors.push('External monitoring attestation status must equal PASSING.');
  if (canonicalProductionOrigin(payload.productionOrigin) === null || payload.productionOrigin !== normalizedOrigin) errors.push('Monitoring attestation productionOrigin does not match the production target.');

  if (!exactFields(payload.monitoring, MONITORING_FIELDS)) {
    errors.push('Monitoring state must use the exact contract.');
  } else {
    if (payload.monitoring.state !== 'UP') errors.push('External monitor state must equal UP.');
    const checkedAt = canonicalUtcTimestamp(payload.monitoring.lastCheckedAt);
    if (checkedAt === null) errors.push('Monitoring lastCheckedAt must be a canonical UTC timestamp.');
    else {
      const ageMs = now.getTime() - checkedAt;
      if (ageMs < -5 * 60_000) errors.push('Monitoring lastCheckedAt must not be in the future.');
      if (ageMs > maxObservationAgeSeconds * 1000) errors.push('External monitor observation is too old.');
    }
  }

  if (!exactFields(payload.alerting, ALERTING_FIELDS)) {
    errors.push('Alerting state must use the exact contract.');
  } else {
    if (payload.alerting.enabled !== true) errors.push('External alerting must be enabled.');
    if (payload.alerting.lastTestStatus !== 'DELIVERED') errors.push('Latest external alert test must equal DELIVERED.');
    const testedAt = canonicalUtcTimestamp(payload.alerting.lastTestAt);
    if (testedAt === null) errors.push('Alert lastTestAt must be a canonical UTC timestamp.');
    else {
      const ageMs = now.getTime() - testedAt;
      if (ageMs < -5 * 60_000) errors.push('Alert lastTestAt must not be in the future.');
      if (ageMs > maxAlertTestAgeHours * 3_600_000) errors.push('Latest external alert test is too old.');
    }
  }

  if (!exactFields(payload.provider, PROVIDER_FIELDS)) {
    errors.push('Provider identity must use the exact contract.');
  } else {
    if (canonicalProviderName(payload.provider.name) === null) errors.push('Provider name must be canonical and at most 64 characters.');
    if (typeof payload.provider.monitorIdHash !== 'string' || !SHA256.test(payload.provider.monitorIdHash)) errors.push('Provider monitorIdHash must be a lowercase SHA-256 digest.');
  }

  return { ok: errors.length === 0, errors };
}

async function readBoundedJson(response) {
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) throw new Error('Monitoring attestation exceeds the maximum allowed size.');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('Monitoring attestation exceeds the maximum allowed size.');
  return JSON.parse(text);
}

export async function verifyExternalMonitoringAlerting({
  evidenceUrl,
  evidenceToken,
  productionOrigin,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxObservationAgeSeconds = DEFAULT_OBSERVATION_AGE_SECONDS,
  maxAlertTestAgeHours = DEFAULT_ALERT_TEST_AGE_HOURS,
  now = new Date(),
  fetchImpl = fetch,
} = {}) {
  const normalizedUrl = canonicalMonitoringEvidenceUrl(evidenceUrl);
  if (normalizedUrl === null) throw new Error('External monitoring evidence URL must be canonical HTTPS without credentials, query, or fragment.');
  const normalizedOrigin = canonicalProductionOrigin(productionOrigin);
  if (normalizedOrigin === null) throw new Error('Production origin must be a canonical HTTPS origin without credentials, path, query, or fragment.');
  if (typeof evidenceToken !== 'string' || evidenceToken !== evidenceToken.trim() || evidenceToken.length < MIN_TOKEN_LENGTH) throw new Error('External monitoring evidence token must be canonical and at least 32 characters.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) throw new Error(`External monitoring timeout must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(normalizedUrl, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: { accept: 'application/json', authorization: `Bearer ${evidenceToken}` },
    });
  } finally {
    clearTimeout(timer);
  }
  if (response.status !== 200) throw new Error(`External monitoring evidence endpoint returned HTTP ${response.status}.`);
  const contentType = response.headers?.get?.('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) throw new Error('External monitoring evidence endpoint must return application/json.');

  let payload;
  try {
    payload = await readBoundedJson(response);
  } catch (error) {
    throw new Error(`External monitoring evidence endpoint returned invalid or unsafe JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = validateMonitoringAttestation(payload, { productionOrigin: normalizedOrigin, now, maxObservationAgeSeconds, maxAlertTestAgeHours });
  if (!result.ok) throw new Error(result.errors.join(' '));

  return {
    schemaVersion: 1,
    kind: 'knowme-external-monitoring-alerting-smoke',
    status: 'PASSED',
    observedAt: now.toISOString(),
    productionOrigin: normalizedOrigin,
    evidenceEndpointSha256: createHash('sha256').update(normalizedUrl, 'utf8').digest('hex'),
    providerName: payload.provider.name,
    monitorIdHash: payload.provider.monitorIdHash,
    monitoring: { state: payload.monitoring.state, lastCheckedAt: payload.monitoring.lastCheckedAt },
    alerting: { enabled: true, lastTestAt: payload.alerting.lastTestAt, lastTestStatus: payload.alerting.lastTestStatus },
    policy: { maxObservationAgeSeconds, maxAlertTestAgeHours },
  };
}

export async function writeExternalMonitoringEvidence(outputPath, artifact) {
  if (typeof outputPath !== 'string' || outputPath !== outputPath.trim() || outputPath.length < 1 || CONTROL_CHARACTERS.test(outputPath)) throw new Error('Monitoring evidence output path must be canonical and free of control characters.');
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  let handle;
  let created = false;
  try {
    handle = await open(outputPath, 'wx', 0o600);
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    if (created) {
      try { await handle?.close(); } catch {}
      try { const { unlink } = await import('node:fs/promises'); await unlink(outputPath); } catch {}
      handle = undefined;
    }
    throw error;
  } finally {
    await handle?.close();
  }
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const evidenceUrl = readArg('--evidence-url') ?? process.env.KNOWME_EXTERNAL_MONITORING_EVIDENCE_URL;
  const evidenceToken = process.env.KNOWME_EXTERNAL_MONITORING_EVIDENCE_TOKEN;
  const productionOrigin = readArg('--production-origin') ?? process.env.KNOWME_PRODUCTION_BASE_URL;
  const timeoutMs = canonicalPositiveInteger(readArg('--timeout-ms') ?? process.env.KNOWME_EXTERNAL_MONITORING_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const maxObservationAgeSeconds = canonicalPositiveInteger(readArg('--max-observation-age-seconds') ?? process.env.KNOWME_EXTERNAL_MONITORING_MAX_OBSERVATION_AGE_SECONDS, MIN_OBSERVATION_AGE_SECONDS, MAX_OBSERVATION_AGE_SECONDS, DEFAULT_OBSERVATION_AGE_SECONDS);
  const maxAlertTestAgeHours = canonicalPositiveInteger(readArg('--max-alert-test-age-hours') ?? process.env.KNOWME_EXTERNAL_MONITORING_MAX_ALERT_TEST_AGE_HOURS, MIN_ALERT_TEST_AGE_HOURS, MAX_ALERT_TEST_AGE_HOURS, DEFAULT_ALERT_TEST_AGE_HOURS);
  if (timeoutMs === null || maxObservationAgeSeconds === null || maxAlertTestAgeHours === null) throw new Error('External monitoring smoke policy values must be canonical integers within their documented bounds.');
  const artifact = await verifyExternalMonitoringAlerting({ evidenceUrl, evidenceToken, productionOrigin, timeoutMs, maxObservationAgeSeconds, maxAlertTestAgeHours });
  const output = readArg('--output');
  if (output) {
    const written = await writeExternalMonitoringEvidence(output, artifact);
    console.log(`External monitoring/alerting smoke passed; evidence SHA-256 ${written.sha256}.`);
  } else {
    console.log('External monitoring/alerting smoke passed.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

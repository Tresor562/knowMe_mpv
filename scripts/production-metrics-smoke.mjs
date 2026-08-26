#!/usr/bin/env node

const MIN_TOKEN_LENGTH = 32;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const BUCKETS = ['le_100', 'le_250', 'le_500', 'le_1000', 'le_2500', 'le_5000'];

export function canonicalProductionBaseUrl(value) {
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

function canonicalTimeout(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_TIMEOUT_MS;
  if (typeof value !== 'string' || value !== value.trim() || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= MIN_TIMEOUT_MS && parsed <= MAX_TIMEOUT_MS ? parsed : null;
}

function nonNegativeFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function validateMetricsPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, errors: ['Metrics response must be a JSON object.'] };
  if (payload.service !== 'knowme-api') errors.push('Metrics service must equal knowme-api.');
  if (!Number.isInteger(payload.uptimeSeconds) || payload.uptimeSeconds < 0) errors.push('Metrics uptimeSeconds must be a non-negative integer.');

  const requests = payload.http?.requests;
  const latency = payload.http?.latencyMs;
  if (!requests || typeof requests !== 'object' || Array.isArray(requests)) {
    errors.push('Metrics request counters are missing.');
  } else {
    for (const key of ['total', 'success2xx', 'clientError4xx', 'serverError5xx', 'other']) {
      if (!Number.isSafeInteger(requests[key]) || requests[key] < 0) errors.push(`Metrics request counter ${key} must be a non-negative safe integer.`);
    }
    if (errors.length === 0 && requests.success2xx + requests.clientError4xx + requests.serverError5xx + requests.other !== requests.total) {
      errors.push('Metrics request counters must add up to total.');
    }
  }

  if (!latency || typeof latency !== 'object' || Array.isArray(latency)) {
    errors.push('Metrics latency snapshot is missing.');
  } else {
    if (!Number.isSafeInteger(latency.count) || latency.count < 0) errors.push('Metrics latency count must be a non-negative safe integer.');
    if (!nonNegativeFiniteNumber(latency.sum)) errors.push('Metrics latency sum must be a non-negative finite number.');
    if (!nonNegativeFiniteNumber(latency.max)) errors.push('Metrics latency max must be a non-negative finite number.');
    if (!latency.buckets || typeof latency.buckets !== 'object' || Array.isArray(latency.buckets)) {
      errors.push('Metrics latency buckets are missing.');
    } else {
      for (const bucket of BUCKETS) {
        if (!Number.isSafeInteger(latency.buckets[bucket]) || latency.buckets[bucket] < 0) errors.push(`Metrics latency bucket ${bucket} must be a non-negative safe integer.`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

async function readBoundedJson(response) {
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) throw new Error('Metrics response exceeds the maximum allowed size.');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('Metrics response exceeds the maximum allowed size.');
  return JSON.parse(text);
}

export async function verifyProductionMetrics({ baseUrl, metricsToken, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const normalizedBaseUrl = canonicalProductionBaseUrl(baseUrl);
  if (normalizedBaseUrl === null) throw new Error('Production base URL must be a canonical HTTPS origin without credentials, path, query, or fragment.');
  if (typeof metricsToken !== 'string' || metricsToken !== metricsToken.trim() || metricsToken.length < MIN_TOKEN_LENGTH) throw new Error('Metrics bearer token must be canonical and at least 32 characters.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) throw new Error(`Metrics smoke timeout must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`);

  const metricsUrl = new URL('health/metrics', normalizedBaseUrl).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(metricsUrl, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: { accept: 'application/json', authorization: `Bearer ${metricsToken}` },
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status !== 200) throw new Error(`Production metrics returned HTTP ${response.status}.`);
  const contentType = response.headers?.get?.('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) throw new Error('Production metrics must return application/json.');

  let payload;
  try {
    payload = await readBoundedJson(response);
  } catch (error) {
    throw new Error(`Production metrics returned invalid or unsafe JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = validateMetricsPayload(payload);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return { ok: true, metricsUrl };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const baseUrl = readArg('--url') ?? process.env.KNOWME_PRODUCTION_BASE_URL;
  const metricsToken = process.env.METRICS_BEARER_TOKEN;
  const rawTimeout = readArg('--timeout-ms') ?? process.env.KNOWME_PRODUCTION_METRICS_SMOKE_TIMEOUT_MS;
  const timeoutMs = canonicalTimeout(rawTimeout);
  if (timeoutMs === null) throw new Error(`KNOWME_PRODUCTION_METRICS_SMOKE_TIMEOUT_MS must be a canonical integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}.`);
  await verifyProductionMetrics({ baseUrl, metricsToken, timeoutMs });
  console.log('Production metrics smoke passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node

const SHA40 = /^[0-9a-f]{40}$/;
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 64 * 1024;

function canonicalCommit(value) {
  return typeof value === 'string' && value === value.trim() && SHA40.test(value) ? value : null;
}

function canonicalVersion(value) {
  return typeof value === 'string' && value === value.trim() && RELEASE_VERSION.test(value) ? value : null;
}

function canonicalTimeout(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_TIMEOUT_MS;
  if (typeof value !== 'string' || value !== value.trim() || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= MIN_TIMEOUT_MS && parsed <= MAX_TIMEOUT_MS ? parsed : null;
}

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

export function validateReadyPayload(payload, { expectedCommit, expectedVersion } = {}) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['Readiness response must be a JSON object.'] };
  }
  if (payload.status !== 'ready') errors.push('Readiness status must equal ready.');
  if (payload.service !== 'knowme-api') errors.push('Readiness service must equal knowme-api.');
  if (!payload.checks || payload.checks.database !== 'up') errors.push('Readiness database check must equal up.');
  if (!payload.release || typeof payload.release !== 'object' || Array.isArray(payload.release)) {
    errors.push('Readiness release identity is missing.');
  } else {
    if (payload.release.commit !== expectedCommit) errors.push('Deployed commit does not match the release candidate.');
    if (payload.release.version !== expectedVersion) errors.push('Deployed version does not match the release candidate.');
  }
  return { ok: errors.length === 0, errors };
}

async function readBoundedJson(response) {
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error('Readiness response exceeds the maximum allowed size.');
  }

  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('Readiness response exceeds the maximum allowed size.');
    return JSON.parse(text);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Readiness response exceeds the maximum allowed size.');
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8'));
}

export async function verifyProductionDeployment({ baseUrl, expectedCommit, expectedVersion, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const normalizedBaseUrl = canonicalProductionBaseUrl(baseUrl);
  if (normalizedBaseUrl === null) throw new Error('Production base URL must be a canonical HTTPS origin without credentials, path, query, or fragment.');
  if (canonicalCommit(expectedCommit) === null) throw new Error('Expected release commit must be an exact lowercase 40-character Git SHA.');
  if (canonicalVersion(expectedVersion) === null) throw new Error('Expected release version must be canonical SemVer without build metadata.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`Smoke timeout must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`);
  }

  const readyUrl = new URL('health/ready', normalizedBaseUrl).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(readyUrl, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status !== 200) throw new Error(`Production readiness returned HTTP ${response.status}.`);
  const contentType = response.headers?.get?.('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) throw new Error('Production readiness must return application/json.');

  let payload;
  try {
    payload = await readBoundedJson(response);
  } catch (error) {
    throw new Error(`Production readiness returned invalid or unsafe JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const result = validateReadyPayload(payload, { expectedCommit, expectedVersion });
  if (!result.ok) throw new Error(result.errors.join(' '));

  return {
    ok: true,
    readyUrl,
    release: { commit: expectedCommit, version: expectedVersion },
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const baseUrl = readArg('--url') ?? process.env.KNOWME_PRODUCTION_BASE_URL;
  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const rawTimeout = readArg('--timeout-ms') ?? process.env.KNOWME_PRODUCTION_SMOKE_TIMEOUT_MS;
  const timeoutMs = canonicalTimeout(rawTimeout);
  if (timeoutMs === null) throw new Error(`KNOWME_PRODUCTION_SMOKE_TIMEOUT_MS must be a canonical integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}.`);

  const result = await verifyProductionDeployment({ baseUrl, expectedCommit, expectedVersion, timeoutMs });
  console.log(`Production deployment smoke passed for ${result.release.version} at ${result.release.commit}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

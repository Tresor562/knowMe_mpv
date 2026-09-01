#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';

const MAX_RESPONSE_BYTES = 512 * 1024;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 10_000;
const CONFIRMATION = 'DELETE_EPHEMERAL_CANARY';
const SHA256 = /^[0-9a-f]{64}$/;

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalPositiveInteger(value, min, max) {
  if (!nonEmpty(value) || value !== value.trim() || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function canonicalProductionOrigin(value) {
  if (!nonEmpty(value) || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== '/' || !url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function canonicalUtcTimestamp(value) {
  if (!nonEmpty(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

async function readBoundedJson(response, label) {
  const contentType = response.headers?.get?.('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`${label} did not return application/json.`);
  }
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error(`${label} response exceeded ${MAX_RESPONSE_BYTES} bytes.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

async function requestJson(fetchImpl, url, { method = 'GET', body, token, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchImpl(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error',
      signal: controller.signal,
    });
    const json = await readBoundedJson(response, `${method} ${new URL(url).pathname}`);
    return { status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function safeIdHash(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function createCanaryCredentials(randomBytesImpl = randomBytes) {
  const suffix = randomBytesImpl(8).toString('hex');
  return {
    email: `km-release-${suffix}@example.invalid`,
    username: `kmrel_${suffix.slice(0, 12)}`,
    displayName: 'KnowMe Release Canary',
    password: `Km!${randomBytesImpl(18).toString('base64url')}9a`,
  };
}

function validateRegistration(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Registration payload must be an object.');
  if (!nonEmpty(payload.accessToken)) throw new Error('Registration did not return an access token.');
  if (!payload.user || typeof payload.user !== 'object' || !nonEmpty(payload.user.id)) {
    throw new Error('Registration did not return a canonical user id.');
  }
  return { accessToken: payload.accessToken, userId: payload.user.id };
}

function validateExport(payload, expectedUserId) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Account export payload must be an object.');
  if (!canonicalUtcTimestamp(payload.exportedAt)) throw new Error('Account export exportedAt must be canonical UTC.');
  if (!Number.isSafeInteger(payload.formatVersion) || payload.formatVersion < 1) throw new Error('Account export formatVersion must be a positive integer.');
  if (!payload.account || payload.account.id !== expectedUserId) throw new Error('Account export does not belong to the ephemeral canary.');
  if ('passwordHash' in payload.account) throw new Error('Account export leaked passwordHash.');
  return { formatVersion: payload.formatVersion, exportedAt: payload.exportedAt };
}

async function bestEffortDelete(fetchImpl, origin, token, password, timeoutMs) {
  try {
    await requestJson(fetchImpl, `${origin}/account`, {
      method: 'DELETE',
      body: { password },
      token,
      timeoutMs,
    });
  } catch {
    // Best-effort cleanup only. The original smoke failure remains authoritative.
  }
}

export async function runDataExportDeleteSmoke({
  origin,
  confirmation,
  timeoutMs = 5_000,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  randomBytesImpl = randomBytes,
} = {}) {
  const normalizedOrigin = canonicalProductionOrigin(origin);
  if (!normalizedOrigin) throw new Error('Production origin must be a canonical HTTPS origin without credentials, path, query, or fragment.');
  if (confirmation !== CONFIRMATION) throw new Error(`Destructive canary confirmation must equal ${CONFIRMATION}.`);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`Timeout must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`);
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required.');

  const credentials = createCanaryCredentials(randomBytesImpl);
  let token = null;
  let userId = null;
  let deleted = false;

  try {
    const registration = await requestJson(fetchImpl, `${normalizedOrigin}/auth/register`, {
      method: 'POST',
      body: credentials,
      timeoutMs,
    });
    if (registration.status !== 201) throw new Error(`Ephemeral canary registration returned HTTP ${registration.status}.`);
    ({ accessToken: token, userId } = validateRegistration(registration.json));

    const exported = await requestJson(fetchImpl, `${normalizedOrigin}/account/export`, {
      token,
      timeoutMs,
    });
    if (exported.status !== 200) throw new Error(`Account export returned HTTP ${exported.status}.`);
    const exportSummary = validateExport(exported.json, userId);

    const deletion = await requestJson(fetchImpl, `${normalizedOrigin}/account`, {
      method: 'DELETE',
      body: { password: credentials.password },
      token,
      timeoutMs,
    });
    if (deletion.status < 200 || deletion.status >= 300) throw new Error(`Account deletion returned HTTP ${deletion.status}.`);
    deleted = true;

    const oldBearerAfterDelete = await requestJson(fetchImpl, `${normalizedOrigin}/account/export`, {
      token,
      timeoutMs,
    });
    if (oldBearerAfterDelete.status !== 401) {
      throw new Error(`Pre-deletion bearer token must lose authorization with HTTP 401 after account deletion, got ${oldBearerAfterDelete.status}.`);
    }

    const loginAfterDelete = await requestJson(fetchImpl, `${normalizedOrigin}/auth/login`, {
      method: 'POST',
      body: { identifier: credentials.username, password: credentials.password },
      timeoutMs,
    });
    if (loginAfterDelete.status !== 401) {
      throw new Error(`Deleted canary authentication must be rejected with HTTP 401, got ${loginAfterDelete.status}.`);
    }

    const observedAt = now().toISOString();
    if (!canonicalUtcTimestamp(observedAt)) throw new Error('Smoke clock must produce a canonical UTC timestamp.');
    const canaryUserIdSha256 = safeIdHash(userId);
    if (!SHA256.test(canaryUserIdSha256)) throw new Error('Canary id digest is invalid.');

    return {
      schemaVersion: 2,
      kind: 'knowme-data-export-delete-smoke',
      status: 'PASSED',
      observedAt,
      productionOrigin: normalizedOrigin,
      canaryUserIdSha256,
      checks: {
        ephemeralRegistration: 'PASSED',
        accountExport: 'PASSED',
        exportFormatVersion: exportSummary.formatVersion,
        passwordHashExcluded: true,
        accountDeletion: 'PASSED',
        preDeletionBearerAuthorizationRevoked: true,
        deletedAccountAuthenticationRejected: true,
      },
      proofBoundary: 'This artifact proves only this ephemeral canary export/delete flow, immediate revocation of its pre-deletion bearer authorization, and rejected password login at the observed production origin; it does not prove legal compliance or deletion from provider backups outside KnowMe.',
    };
  } catch (error) {
    if (token && !deleted) await bestEffortDelete(fetchImpl, normalizedOrigin, token, credentials.password, timeoutMs);
    throw error;
  }
}

export async function writeDataExportDeleteSmokeArtifact(outputPath, artifact) {
  if (!nonEmpty(outputPath) || outputPath !== outputPath.trim() || /[\u0000-\u001f\u007f]/.test(outputPath)) {
    throw new Error('Output path must be canonical and free of control characters.');
  }
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  let created = false;
  let handle;
  try {
    handle = await open(outputPath, 'wx', 0o600);
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    if (created) await unlink(outputPath).catch(() => {});
    throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
  return { sha256: createHash('sha256').update(bytes).digest('hex'), bytes };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const origin = readArg('--origin') ?? process.env.KNOWME_PRODUCTION_ORIGIN;
  const confirmation = readArg('--confirm') ?? process.env.KNOWME_DATA_LIFECYCLE_SMOKE_CONFIRM;
  const timeoutRaw = readArg('--timeout-ms') ?? process.env.KNOWME_DATA_LIFECYCLE_SMOKE_TIMEOUT_MS ?? '5000';
  const timeoutMs = canonicalPositiveInteger(timeoutRaw, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
  if (timeoutMs === null) throw new Error(`Timeout must be a canonical integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`);

  const artifact = await runDataExportDeleteSmoke({ origin, confirmation, timeoutMs });
  const output = readArg('--output');
  if (output) {
    const written = await writeDataExportDeleteSmokeArtifact(output, artifact);
    console.log(`Data export/delete smoke passed. Evidence SHA-256: ${written.sha256}`);
  } else {
    console.log('Data export/delete smoke passed. No artifact written because --output was not provided.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Data export/delete smoke failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

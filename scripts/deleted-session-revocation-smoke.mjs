#!/usr/bin/env node

import { randomBytes } from 'node:crypto';

const CONFIRMATION = 'DELETE_EPHEMERAL_SESSION_CANARY';
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 256 * 1024;

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
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
    return { status: response.status, json: await readBoundedJson(response, `${method} ${new URL(url).pathname}`) };
  } finally {
    clearTimeout(timer);
  }
}

function createCredentials(randomBytesImpl = randomBytes) {
  const suffix = randomBytesImpl(8).toString('hex');
  return {
    email: `km-session-${suffix}@example.invalid`,
    username: `kmsess_${suffix.slice(0, 12)}`,
    displayName: 'KnowMe Session Revocation Canary',
    password: `Km!${randomBytesImpl(18).toString('base64url')}9a`,
  };
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
    // Cleanup only; the original failure remains authoritative.
  }
}

export async function runDeletedSessionRevocationSmoke({
  origin,
  confirmation,
  timeoutMs = 5_000,
  fetchImpl = globalThis.fetch,
  randomBytesImpl = randomBytes,
} = {}) {
  const normalizedOrigin = canonicalProductionOrigin(origin);
  if (!normalizedOrigin) throw new Error('Production origin must be a canonical HTTPS origin.');
  if (confirmation !== CONFIRMATION) throw new Error(`Destructive canary confirmation must equal ${CONFIRMATION}.`);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`Timeout must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`);
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required.');

  const credentials = createCredentials(randomBytesImpl);
  let token = null;
  let deleted = false;
  try {
    const registration = await requestJson(fetchImpl, `${normalizedOrigin}/auth/register`, {
      method: 'POST',
      body: credentials,
      timeoutMs,
    });
    if (registration.status !== 201 || !nonEmpty(registration.json?.accessToken) || !nonEmpty(registration.json?.user?.id)) {
      throw new Error(`Ephemeral session canary registration failed with HTTP ${registration.status}.`);
    }
    token = registration.json.accessToken;

    const beforeDelete = await requestJson(fetchImpl, `${normalizedOrigin}/account/export`, { token, timeoutMs });
    if (beforeDelete.status !== 200) throw new Error(`Canary token was not valid before deletion: HTTP ${beforeDelete.status}.`);

    const deletion = await requestJson(fetchImpl, `${normalizedOrigin}/account`, {
      method: 'DELETE',
      body: { password: credentials.password },
      token,
      timeoutMs,
    });
    if (deletion.status < 200 || deletion.status >= 300) throw new Error(`Account deletion returned HTTP ${deletion.status}.`);
    deleted = true;

    const oldTokenAfterDelete = await requestJson(fetchImpl, `${normalizedOrigin}/account/export`, { token, timeoutMs });
    if (oldTokenAfterDelete.status !== 401) {
      throw new Error(`Deleted account access token must be rejected with HTTP 401, got ${oldTokenAfterDelete.status}.`);
    }

    const loginAfterDelete = await requestJson(fetchImpl, `${normalizedOrigin}/auth/login`, {
      method: 'POST',
      body: { identifier: credentials.username, password: credentials.password },
      timeoutMs,
    });
    if (loginAfterDelete.status !== 401) {
      throw new Error(`Deleted account login must be rejected with HTTP 401, got ${loginAfterDelete.status}.`);
    }

    return {
      status: 'PASSED',
      productionOrigin: normalizedOrigin,
      checks: {
        tokenValidBeforeDeletion: true,
        accountDeletion: 'PASSED',
        deletedAccountAccessTokenRejected: true,
        deletedAccountLoginRejected: true,
      },
      proofBoundary:
        'This smoke proves only that one ephemeral production canary loses both its already-issued access token and password login after account deletion; it does not prove legal compliance, provider-backup erasure, refresh-token behavior outside the tested flow, or every external identity provider.',
    };
  } catch (error) {
    if (token && !deleted) await bestEffortDelete(fetchImpl, normalizedOrigin, token, credentials.password, timeoutMs);
    throw error;
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const origin = readArg('--origin') ?? process.env.KNOWME_PRODUCTION_ORIGIN;
  const confirmation = readArg('--confirm') ?? process.env.KNOWME_DELETED_SESSION_SMOKE_CONFIRM;
  const timeoutRaw = readArg('--timeout-ms') ?? process.env.KNOWME_DELETED_SESSION_SMOKE_TIMEOUT_MS ?? '5000';
  if (!/^[1-9]\d*$/.test(timeoutRaw)) throw new Error('Timeout must be a canonical positive integer.');
  const result = await runDeletedSessionRevocationSmoke({ origin, confirmation, timeoutMs: Number(timeoutRaw) });
  console.log(`Deleted-session revocation smoke ${result.status}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Deleted-session revocation smoke failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

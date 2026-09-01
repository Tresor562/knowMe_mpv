#!/usr/bin/env node

import { createHash, createHmac, randomBytes } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';

const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 60000;
const DEFAULT_TIMEOUT_MS = 10000;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function canonicalPositiveInteger(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || value !== value.trim() || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= MIN_TIMEOUT_MS && parsed <= MAX_TIMEOUT_MS ? parsed : null;
}

function canonicalHttpsEndpoint(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

function canonicalBucket(value) {
  return typeof value === 'string' && value === value.trim() && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/i.test(value)
    ? value
    : null;
}

function canonicalRegion(value) {
  return typeof value === 'string' && value === value.trim() && /^[a-z0-9][a-z0-9-]{0,62}$/i.test(value)
    ? value
    : null;
}

function canonicalCredential(value, name) {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 8 || CONTROL_CHARACTERS.test(value)) {
    throw new Error(`${name} must be canonical and non-empty.`);
  }
  return value;
}

function amzDate(value) {
  return value.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function signingKey(secret, dateStamp, region) {
  const dateKey = createHmac('sha256', `AWS4${secret}`).update(dateStamp).digest();
  const regionKey = createHmac('sha256', dateKey).update(region).digest();
  const serviceKey = createHmac('sha256', regionKey).update('s3').digest();
  return createHmac('sha256', serviceKey).update('aws4_request').digest();
}

function objectUrl(endpoint, bucket, key) {
  const basePath = endpoint.pathname.replace(/\/$/, '');
  const url = new URL(endpoint.toString());
  url.pathname = `${basePath}/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`.replace(/\/+/g, '/');
  url.search = '';
  url.hash = '';
  return url;
}

function signedRequest({ method, url, body, contentType, region, accessKeyId, secretAccessKey, sessionToken, now }) {
  const stamp = amzDate(now);
  const dateStamp = stamp.slice(0, 8);
  const payloadHash = createHash('sha256').update(body ?? Buffer.alloc(0)).digest('hex');
  const headers = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': stamp,
  };
  if (contentType) headers['content-type'] = contentType;
  if (sessionToken) headers['x-amz-security-token'] = sessionToken;
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name].trim()}\n`).join('');
  const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaderNames.join(';'), payloadHash].join('\n');
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    stamp,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const signature = createHmac('sha256', signingKey(secretAccessKey, dateStamp, region)).update(stringToSign).digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames.join(';')}, Signature=${signature}`;
  return { method, headers, body: body ? new Uint8Array(body) : undefined };
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal, redirect: 'error' });
  } finally {
    clearTimeout(timer);
  }
}

function assertStatus(response, allowed, label) {
  if (!allowed.includes(response.status)) {
    throw new Error(`${label} failed with HTTP ${response.status}.`);
  }
}

export async function runObjectStorageProviderSmoke({
  endpoint,
  bucket,
  region,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = new Date(),
  fetchImpl = fetch,
  randomBytesImpl = randomBytes,
} = {}) {
  const normalizedEndpoint = canonicalHttpsEndpoint(endpoint);
  if (!normalizedEndpoint) throw new Error('MEDIA_S3_ENDPOINT must be canonical HTTPS without credentials, query, or fragment.');
  const normalizedBucket = canonicalBucket(bucket);
  if (!normalizedBucket) throw new Error('MEDIA_S3_BUCKET is invalid.');
  const normalizedRegion = canonicalRegion(region);
  if (!normalizedRegion) throw new Error('MEDIA_S3_REGION is invalid.');
  const normalizedAccessKeyId = canonicalCredential(accessKeyId, 'MEDIA_S3_ACCESS_KEY_ID');
  const normalizedSecretAccessKey = canonicalCredential(secretAccessKey, 'MEDIA_S3_SECRET_ACCESS_KEY');
  const normalizedSessionToken = sessionToken ? canonicalCredential(sessionToken, 'MEDIA_S3_SESSION_TOKEN') : undefined;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`Object-storage timeout must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`);
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Smoke timestamp is invalid.');

  const key = `knowme-release-smoke-${randomBytesImpl(12).toString('hex')}.bin`;
  const body = randomBytesImpl(32);
  const url = objectUrl(normalizedEndpoint, normalizedBucket, key);
  const auth = { region: normalizedRegion, accessKeyId: normalizedAccessKeyId, secretAccessKey: normalizedSecretAccessKey, sessionToken: normalizedSessionToken, now };
  let created = false;

  try {
    const put = await fetchWithTimeout(fetchImpl, url, signedRequest({ method: 'PUT', url, body, contentType: 'application/octet-stream', ...auth }), timeoutMs);
    assertStatus(put, [200, 201, 204], 'Signed object PUT');
    created = true;

    const anonymous = await fetchWithTimeout(fetchImpl, url, { method: 'GET', headers: { accept: 'application/octet-stream' } }, timeoutMs);
    if (anonymous.status === 200) throw new Error('Private object storage allowed anonymous object retrieval.');
    if (![401, 403, 404].includes(anonymous.status)) throw new Error(`Anonymous object privacy probe returned unexpected HTTP ${anonymous.status}.`);

    const get = await fetchWithTimeout(fetchImpl, url, signedRequest({ method: 'GET', url, ...auth }), timeoutMs);
    assertStatus(get, [200], 'Signed object GET');
    const downloaded = Buffer.from(await get.arrayBuffer());
    if (!downloaded.equals(body)) throw new Error('Signed object GET returned bytes that differ from the uploaded canary.');

    const del = await fetchWithTimeout(fetchImpl, url, signedRequest({ method: 'DELETE', url, ...auth }), timeoutMs);
    assertStatus(del, [200, 204], 'Signed object DELETE');
    created = false;

    const afterDelete = await fetchWithTimeout(fetchImpl, url, signedRequest({ method: 'GET', url, ...auth }), timeoutMs);
    assertStatus(afterDelete, [404], 'Post-delete signed GET');

    return {
      schemaVersion: 1,
      kind: 'knowme-object-storage-provider-smoke',
      status: 'PASSED',
      observedAt: now.toISOString(),
      endpointSha256: createHash('sha256').update(normalizedEndpoint.toString(), 'utf8').digest('hex'),
      bucketSha256: createHash('sha256').update(normalizedBucket, 'utf8').digest('hex'),
      region: normalizedRegion,
      canaryBytes: body.length,
      checks: {
        signedPut: true,
        anonymousReadDenied: true,
        signedReadMatched: true,
        signedDelete: true,
        postDeleteNotFound: true,
      },
    };
  } finally {
    if (created) {
      try {
        await fetchWithTimeout(fetchImpl, url, signedRequest({ method: 'DELETE', url, ...auth }), timeoutMs);
      } catch {}
    }
  }
}

export async function writeObjectStorageSmokeEvidence(outputPath, artifact) {
  if (typeof outputPath !== 'string' || outputPath !== outputPath.trim() || !outputPath || CONTROL_CHARACTERS.test(outputPath)) {
    throw new Error('Object-storage evidence output path must be canonical and free of control characters.');
  }
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
      try { await unlink(outputPath); } catch {}
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
  const timeoutMs = canonicalPositiveInteger(readArg('--timeout-ms') ?? process.env.KNOWME_OBJECT_STORAGE_SMOKE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  if (timeoutMs === null) throw new Error(`KNOWME_OBJECT_STORAGE_SMOKE_TIMEOUT_MS must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}.`);
  const artifact = await runObjectStorageProviderSmoke({
    endpoint: process.env.MEDIA_S3_ENDPOINT,
    bucket: process.env.MEDIA_S3_BUCKET,
    region: process.env.MEDIA_S3_REGION,
    accessKeyId: process.env.MEDIA_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.MEDIA_S3_SECRET_ACCESS_KEY,
    sessionToken: process.env.MEDIA_S3_SESSION_TOKEN,
    timeoutMs,
  });
  const output = readArg('--output');
  if (output) {
    const written = await writeObjectStorageSmokeEvidence(output, artifact);
    console.log(`Object-storage provider smoke passed; evidence SHA-256 ${written.sha256}.`);
  } else {
    console.log('Object-storage provider smoke passed.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

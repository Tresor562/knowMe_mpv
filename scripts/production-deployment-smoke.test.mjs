import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalProductionBaseUrl,
  validateReadyPayload,
  verifyProductionDeployment,
} from './production-deployment-smoke.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';

function jsonResponse(payload, { status = 200, contentType = 'application/json', extraHeaders = {} } = {}) {
  const body = JSON.stringify(payload);
  return new Response(body, {
    status,
    headers: {
      'content-type': contentType,
      ...extraHeaders,
    },
  });
}

test('accepts only a canonical HTTPS production origin', () => {
  assert.equal(canonicalProductionBaseUrl('https://knowme.example'), 'https://knowme.example/');
  assert.equal(canonicalProductionBaseUrl('http://knowme.example'), null);
  assert.equal(canonicalProductionBaseUrl('https://user:pass@knowme.example'), null);
  assert.equal(canonicalProductionBaseUrl('https://knowme.example/api'), null);
  assert.equal(canonicalProductionBaseUrl('https://knowme.example?token=x'), null);
  assert.equal(canonicalProductionBaseUrl(' https://knowme.example'), null);
});

test('validates the exact runtime release identity and database readiness', () => {
  assert.deepEqual(
    validateReadyPayload(
      {
        status: 'ready',
        service: 'knowme-api',
        release: { commit, version },
        checks: { database: 'up' },
      },
      { expectedCommit: commit, expectedVersion: version },
    ),
    { ok: true, errors: [] },
  );

  const mismatch = validateReadyPayload(
    {
      status: 'ready',
      service: 'knowme-api',
      release: { commit: 'b'.repeat(40), version },
      checks: { database: 'up' },
    },
    { expectedCommit: commit, expectedVersion: version },
  );
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.errors.join(' '), /commit/i);
});

test('performs a bounded no-redirect readiness request', async () => {
  let observedUrl;
  let observedOptions;
  const fetchImpl = async (url, options) => {
    observedUrl = url;
    observedOptions = options;
    return jsonResponse({
      status: 'ready',
      service: 'knowme-api',
      release: { commit, version },
      checks: { database: 'up' },
    });
  };

  const result = await verifyProductionDeployment({
    baseUrl: 'https://knowme.example',
    expectedCommit: commit,
    expectedVersion: version,
    timeoutMs: 1000,
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(observedUrl, 'https://knowme.example/health/ready');
  assert.equal(observedOptions.method, 'GET');
  assert.equal(observedOptions.redirect, 'error');
  assert.equal(observedOptions.headers.accept, 'application/json');
});

test('fails closed on HTTP, content type, malformed JSON, and release mismatch', async () => {
  await assert.rejects(
    verifyProductionDeployment({
      baseUrl: 'https://knowme.example',
      expectedCommit: commit,
      expectedVersion: version,
      fetchImpl: async () => jsonResponse({}, { status: 503 }),
    }),
    /HTTP 503/,
  );

  await assert.rejects(
    verifyProductionDeployment({
      baseUrl: 'https://knowme.example',
      expectedCommit: commit,
      expectedVersion: version,
      fetchImpl: async () => jsonResponse({}, { contentType: 'text/plain' }),
    }),
    /application\/json/,
  );

  await assert.rejects(
    verifyProductionDeployment({
      baseUrl: 'https://knowme.example',
      expectedCommit: commit,
      expectedVersion: version,
      fetchImpl: async () => new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }),
    }),
    /invalid or unsafe JSON/,
  );

  await assert.rejects(
    verifyProductionDeployment({
      baseUrl: 'https://knowme.example',
      expectedCommit: commit,
      expectedVersion: version,
      fetchImpl: async () =>
        jsonResponse({
          status: 'ready',
          service: 'knowme-api',
          release: { commit: 'b'.repeat(40), version },
          checks: { database: 'up' },
        }),
    }),
    /commit/i,
  );
});

test('rejects oversized readiness responses before trusting payloads', async () => {
  await assert.rejects(
    verifyProductionDeployment({
      baseUrl: 'https://knowme.example',
      expectedCommit: commit,
      expectedVersion: version,
      fetchImpl: async () =>
        jsonResponse(
          {
            status: 'ready',
            service: 'knowme-api',
            release: { commit, version },
            checks: { database: 'up' },
          },
          { extraHeaders: { 'content-length': String(70 * 1024) } },
        ),
    }),
    /maximum allowed size/,
  );
});

test('rejects non-canonical release inputs before any network request', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    throw new Error('should not be called');
  };

  await assert.rejects(
    verifyProductionDeployment({
      baseUrl: 'https://knowme.example',
      expectedCommit: commit.toUpperCase(),
      expectedVersion: version,
      fetchImpl,
    }),
    /commit/i,
  );
  assert.equal(called, false);

  await assert.rejects(
    verifyProductionDeployment({
      baseUrl: 'https://knowme.example',
      expectedCommit: commit,
      expectedVersion: 'v1.0.0',
      fetchImpl,
    }),
    /version/i,
  );
  assert.equal(called, false);
});

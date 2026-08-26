import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalProductionBaseUrl,
  validateMetricsPayload,
  verifyProductionMetrics,
} from './production-metrics-smoke.mjs';

const token = 'm'.repeat(32);

function metricsPayload() {
  return {
    service: 'knowme-api',
    uptimeSeconds: 42,
    http: {
      requests: { total: 4, success2xx: 3, clientError4xx: 1, serverError5xx: 0, other: 0 },
      latencyMs: {
        count: 4,
        sum: 120,
        max: 60,
        buckets: { le_100: 4, le_250: 4, le_500: 4, le_1000: 4, le_2500: 4, le_5000: 4 },
      },
    },
  };
}

function jsonResponse(payload, { status = 200, contentType = 'application/json', extraHeaders = {} } = {}) {
  const body = JSON.stringify(payload);
  return new Response(body, {
    status,
    headers: { 'content-type': contentType, ...extraHeaders },
  });
}

test('accepts only a canonical HTTPS production origin', () => {
  assert.equal(canonicalProductionBaseUrl('https://knowme.example'), 'https://knowme.example/');
  assert.equal(canonicalProductionBaseUrl('http://knowme.example'), null);
  assert.equal(canonicalProductionBaseUrl('https://u:p@knowme.example'), null);
  assert.equal(canonicalProductionBaseUrl('https://knowme.example/api'), null);
  assert.equal(canonicalProductionBaseUrl('https://knowme.example?token=x'), null);
});

test('validates a bounded metrics payload', () => {
  assert.deepEqual(validateMetricsPayload(metricsPayload()), { ok: true, errors: [] });

  const invalid = metricsPayload();
  invalid.http.requests.total = 99;
  const result = validateMetricsPayload(invalid);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /add up/i);
});

test('performs an authenticated no-redirect metrics request', async () => {
  let observedUrl;
  let observedOptions;
  const result = await verifyProductionMetrics({
    baseUrl: 'https://knowme.example',
    metricsToken: token,
    timeoutMs: 1000,
    fetchImpl: async (url, options) => {
      observedUrl = url;
      observedOptions = options;
      return jsonResponse(metricsPayload());
    },
  });

  assert.equal(result.ok, true);
  assert.equal(observedUrl, 'https://knowme.example/health/metrics');
  assert.equal(observedOptions.redirect, 'error');
  assert.equal(observedOptions.headers.authorization, `Bearer ${token}`);
});

test('rejects weak tokens before making a network request', async () => {
  let called = false;
  await assert.rejects(
    verifyProductionMetrics({
      baseUrl: 'https://knowme.example',
      metricsToken: 'short',
      fetchImpl: async () => {
        called = true;
        return jsonResponse(metricsPayload());
      },
    }),
    /token/i,
  );
  assert.equal(called, false);
});

test('fails closed on HTTP, content type and malformed JSON', async () => {
  await assert.rejects(
    verifyProductionMetrics({
      baseUrl: 'https://knowme.example',
      metricsToken: token,
      fetchImpl: async () => jsonResponse({}, { status: 401 }),
    }),
    /HTTP 401/,
  );

  await assert.rejects(
    verifyProductionMetrics({
      baseUrl: 'https://knowme.example',
      metricsToken: token,
      fetchImpl: async () => jsonResponse(metricsPayload(), { contentType: 'text/plain' }),
    }),
    /application\/json/,
  );

  await assert.rejects(
    verifyProductionMetrics({
      baseUrl: 'https://knowme.example',
      metricsToken: token,
      fetchImpl: async () => new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }),
    }),
    /invalid or unsafe JSON/,
  );
});

test('rejects oversized or structurally unsafe metrics responses', async () => {
  await assert.rejects(
    verifyProductionMetrics({
      baseUrl: 'https://knowme.example',
      metricsToken: token,
      fetchImpl: async () => jsonResponse(metricsPayload(), { extraHeaders: { 'content-length': String(70 * 1024) } }),
    }),
    /maximum allowed size/,
  );

  const invalid = metricsPayload();
  invalid.http.latencyMs.buckets.le_100 = -1;
  await assert.rejects(
    verifyProductionMetrics({
      baseUrl: 'https://knowme.example',
      metricsToken: token,
      fetchImpl: async () => jsonResponse(invalid),
    }),
    /le_100/,
  );
});

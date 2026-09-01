import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalProductionOrigin,
  runDeletedSessionRevocationSmoke,
} from './deleted-session-revocation-smoke.mjs';

function jsonResponse(status, payload) {
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null) },
    text: async () => JSON.stringify(payload),
  };
}

function deterministicRandom(size) {
  return Buffer.alloc(size, 0xcd);
}

function successFetchRecorder() {
  const calls = [];
  let deleted = false;
  const fetchImpl = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    const method = options.method ?? 'GET';
    calls.push({ pathname, method, authorization: options.headers?.Authorization ?? null });
    if (pathname === '/auth/register') {
      return jsonResponse(201, {
        accessToken: 'issued-access-token',
        user: { id: 'session-canary-1', username: 'kmsess_cdcdcdcdcdcd' },
      });
    }
    if (pathname === '/account/export') {
      if (deleted) return jsonResponse(401, { statusCode: 401, message: 'Session expirée ou révoquée.' });
      return jsonResponse(200, {
        exportedAt: '2026-09-01T08:00:00.000Z',
        formatVersion: 20,
        account: { id: 'session-canary-1' },
      });
    }
    if (pathname === '/account' && method === 'DELETE') {
      deleted = true;
      return jsonResponse(200, { deleted: true });
    }
    if (pathname === '/auth/login') return jsonResponse(401, { statusCode: 401, message: 'Identifiants invalides.' });
    throw new Error(`Unexpected request: ${method} ${pathname}`);
  };
  return { calls, fetchImpl };
}

test('accepts only a canonical HTTPS production origin', () => {
  assert.equal(canonicalProductionOrigin('https://knowme.example'), 'https://knowme.example');
  assert.equal(canonicalProductionOrigin('http://knowme.example'), null);
  assert.equal(canonicalProductionOrigin('https://user:pass@knowme.example'), null);
  assert.equal(canonicalProductionOrigin('https://knowme.example/path'), null);
});

test('proves the issued access token works before deletion and is rejected after deletion', async () => {
  const { calls, fetchImpl } = successFetchRecorder();
  const result = await runDeletedSessionRevocationSmoke({
    origin: 'https://knowme.example',
    confirmation: 'DELETE_EPHEMERAL_SESSION_CANARY',
    timeoutMs: 1000,
    fetchImpl,
    randomBytesImpl: deterministicRandom,
  });

  assert.deepEqual(result.checks, {
    tokenValidBeforeDeletion: true,
    accountDeletion: 'PASSED',
    deletedAccountAccessTokenRejected: true,
    deletedAccountLoginRejected: true,
  });
  assert.deepEqual(
    calls.map(({ method, pathname }) => `${method} ${pathname}`),
    [
      'POST /auth/register',
      'GET /account/export',
      'DELETE /account',
      'GET /account/export',
      'POST /auth/login',
    ],
  );
  assert.equal(calls[1].authorization, 'Bearer issued-access-token');
  assert.equal(calls[3].authorization, 'Bearer issued-access-token');
  assert.equal(JSON.stringify(result).includes('issued-access-token'), false);
  assert.equal(JSON.stringify(result).includes('@example.invalid'), false);
});

test('fails closed when the old access token still authorizes after deletion', async () => {
  const { fetchImpl: baseFetch } = successFetchRecorder();
  let exportCalls = 0;
  const fetchImpl = async (url, options) => {
    if (new URL(url).pathname === '/account/export') {
      exportCalls += 1;
      if (exportCalls === 2) {
        return jsonResponse(200, { exportedAt: '2026-09-01T08:00:00.000Z', formatVersion: 20, account: { id: 'session-canary-1' } });
      }
    }
    return baseFetch(url, options);
  };

  await assert.rejects(
    runDeletedSessionRevocationSmoke({
      origin: 'https://knowme.example',
      confirmation: 'DELETE_EPHEMERAL_SESSION_CANARY',
      timeoutMs: 1000,
      fetchImpl,
      randomBytesImpl: deterministicRandom,
    }),
    /access token must be rejected with HTTP 401/,
  );
});

test('requires exact destructive confirmation before network I/O', async () => {
  let called = false;
  await assert.rejects(
    runDeletedSessionRevocationSmoke({
      origin: 'https://knowme.example',
      confirmation: 'yes',
      fetchImpl: async () => {
        called = true;
        throw new Error('must not run');
      },
    }),
    /DELETE_EPHEMERAL_SESSION_CANARY/,
  );
  assert.equal(called, false);
});

test('attempts cleanup when failure happens before deletion', async () => {
  let deleteCalls = 0;
  const fetchImpl = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/auth/register') return jsonResponse(201, { accessToken: 'token', user: { id: 'u-1' } });
    if (pathname === '/account/export') return jsonResponse(500, { statusCode: 500 });
    if (pathname === '/account' && options.method === 'DELETE') {
      deleteCalls += 1;
      return jsonResponse(200, { deleted: true });
    }
    throw new Error('unexpected request');
  };

  await assert.rejects(
    runDeletedSessionRevocationSmoke({
      origin: 'https://knowme.example',
      confirmation: 'DELETE_EPHEMERAL_SESSION_CANARY',
      fetchImpl,
      randomBytesImpl: deterministicRandom,
    }),
    /not valid before deletion/,
  );
  assert.equal(deleteCalls, 1);
});

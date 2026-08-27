import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  canonicalProductionOrigin,
  runDataExportDeleteSmoke,
  writeDataExportDeleteSmokeArtifact,
} from './data-export-delete-smoke.mjs';

function jsonResponse(status, payload) {
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null) },
    text: async () => JSON.stringify(payload),
  };
}

function deterministicRandom(size) {
  return Buffer.alloc(size, 0xab);
}

function successFetchRecorder() {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    calls.push({ pathname, method: options.method ?? 'GET', options });
    if (pathname === '/auth/register') {
      return jsonResponse(201, {
        accessToken: 'canary-access-token',
        refreshToken: 'canary-refresh-token',
        user: { id: 'canary-user-1', username: 'kmrel_abababababab' },
      });
    }
    if (pathname === '/account/export') {
      return jsonResponse(200, {
        exportedAt: '2026-08-27T18:00:00.000Z',
        formatVersion: 20,
        account: { id: 'canary-user-1', username: 'kmrel_abababababab' },
      });
    }
    if (pathname === '/account' && options.method === 'DELETE') return jsonResponse(200, { deleted: true });
    if (pathname === '/auth/login') return jsonResponse(401, { statusCode: 401, message: 'Identifiants invalides.' });
    throw new Error(`Unexpected request: ${options.method ?? 'GET'} ${pathname}`);
  };
  return { calls, fetchImpl };
}

test('accepts only a canonical HTTPS production origin', () => {
  assert.equal(canonicalProductionOrigin('https://knowme.example'), 'https://knowme.example');
  assert.equal(canonicalProductionOrigin('http://knowme.example'), null);
  assert.equal(canonicalProductionOrigin('https://user:pass@knowme.example'), null);
  assert.equal(canonicalProductionOrigin('https://knowme.example/path'), null);
  assert.equal(canonicalProductionOrigin('https://knowme.example?token=x'), null);
  assert.equal(canonicalProductionOrigin(' https://knowme.example'), null);
});

test('runs an ephemeral register -> export -> delete -> rejected-login production lifecycle', async () => {
  const { calls, fetchImpl } = successFetchRecorder();
  const artifact = await runDataExportDeleteSmoke({
    origin: 'https://knowme.example',
    confirmation: 'DELETE_EPHEMERAL_CANARY',
    timeoutMs: 1000,
    fetchImpl,
    now: () => new Date('2026-08-27T18:05:00.000Z'),
    randomBytesImpl: deterministicRandom,
  });

  assert.equal(artifact.schemaVersion, 1);
  assert.equal(artifact.kind, 'knowme-data-export-delete-smoke');
  assert.equal(artifact.status, 'PASSED');
  assert.equal(artifact.productionOrigin, 'https://knowme.example');
  assert.match(artifact.canaryUserIdSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(artifact.checks, {
    ephemeralRegistration: 'PASSED',
    accountExport: 'PASSED',
    exportFormatVersion: 20,
    passwordHashExcluded: true,
    accountDeletion: 'PASSED',
    deletedAccountAuthenticationRejected: true,
  });
  assert.deepEqual(
    calls.map(({ method, pathname }) => `${method} ${pathname}`),
    ['POST /auth/register', 'GET /account/export', 'DELETE /account', 'POST /auth/login'],
  );
  assert.equal(JSON.stringify(artifact).includes('canary-access-token'), false);
  assert.equal(JSON.stringify(artifact).includes('@example.invalid'), false);
});

test('refuses destructive validation without the exact canary confirmation before network I/O', async () => {
  let called = false;
  await assert.rejects(
    runDataExportDeleteSmoke({
      origin: 'https://knowme.example',
      confirmation: 'yes',
      fetchImpl: async () => {
        called = true;
        throw new Error('must not run');
      },
    }),
    /DELETE_EPHEMERAL_CANARY/,
  );
  assert.equal(called, false);
});

test('fails if account export leaks passwordHash and attempts cleanup of the created canary', async () => {
  let deleteCalls = 0;
  const fetchImpl = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/auth/register') return jsonResponse(201, { accessToken: 'token', user: { id: 'u-1' } });
    if (pathname === '/account/export') {
      return jsonResponse(200, {
        exportedAt: '2026-08-27T18:00:00.000Z',
        formatVersion: 20,
        account: { id: 'u-1', passwordHash: 'must-not-export' },
      });
    }
    if (pathname === '/account' && options.method === 'DELETE') {
      deleteCalls += 1;
      return jsonResponse(200, { deleted: true });
    }
    throw new Error('unexpected request');
  };

  await assert.rejects(
    runDataExportDeleteSmoke({
      origin: 'https://knowme.example',
      confirmation: 'DELETE_EPHEMERAL_CANARY',
      fetchImpl,
      randomBytesImpl: deterministicRandom,
    }),
    /passwordHash/,
  );
  assert.equal(deleteCalls, 1);
});

test('fails if the deleted canary can authenticate again', async () => {
  const { fetchImpl: baseFetch } = successFetchRecorder();
  const fetchImpl = async (url, options) => {
    if (new URL(url).pathname === '/auth/login') return jsonResponse(201, { accessToken: 'unexpected-token' });
    return baseFetch(url, options);
  };
  await assert.rejects(
    runDataExportDeleteSmoke({
      origin: 'https://knowme.example',
      confirmation: 'DELETE_EPHEMERAL_CANARY',
      fetchImpl,
      randomBytesImpl: deterministicRandom,
    }),
    /must be rejected with HTTP 401/,
  );
});

test('writes an evidence artifact exclusively and preserves an existing file', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'knowme-kmd291-'));
  const file = path.join(dir, 'data-lifecycle.json');
  try {
    const artifact = { schemaVersion: 1, kind: 'knowme-data-export-delete-smoke', status: 'PASSED' };
    const first = await writeDataExportDeleteSmokeArtifact(file, artifact);
    assert.match(first.sha256, /^[0-9a-f]{64}$/);
    const original = await readFile(file, 'utf8');

    await assert.rejects(writeDataExportDeleteSmokeArtifact(file, { status: 'DIFFERENT' }), { code: 'EEXIST' });
    assert.equal(await readFile(file, 'utf8'), original);

    const other = path.join(dir, 'existing.json');
    await writeFile(other, 'keep-me', 'utf8');
    await assert.rejects(writeDataExportDeleteSmokeArtifact(other, artifact), { code: 'EEXIST' });
    assert.equal(await readFile(other, 'utf8'), 'keep-me');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

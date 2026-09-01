import test from 'node:test';
import assert from 'node:assert/strict';
import { runObjectStorageProviderSmoke } from './media-storage-provider-smoke.mjs';

const base = {
  endpoint: 'https://storage.example.com',
  bucket: 'knowme-media-prod',
  region: 'eu-west-1',
  accessKeyId: 'ACCESSKEY123456',
  secretAccessKey: 'secret-access-key-value-1234567890',
  timeoutMs: 1000,
  now: new Date('2026-09-01T14:40:00.000Z'),
  randomBytesImpl(size) {
    return Buffer.alloc(size, size === 12 ? 0x11 : 0x22);
  },
};

function response(status, body = Buffer.alloc(0)) {
  return {
    status,
    async arrayBuffer() {
      return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
    },
  };
}

test('proves signed write/read/delete while anonymous read stays private', async () => {
  const uploaded = Buffer.alloc(32, 0x22);
  const calls = [];
  const queue = [response(200), response(403), response(200, uploaded), response(204), response(404)];
  const artifact = await runObjectStorageProviderSmoke({
    ...base,
    async fetchImpl(url, init) {
      calls.push({ url: String(url), init });
      return queue.shift();
    },
  });

  assert.equal(artifact.status, 'PASSED');
  assert.equal(artifact.schemaVersion, 1);
  assert.equal(artifact.kind, 'knowme-object-storage-provider-smoke');
  assert.deepEqual(artifact.checks, {
    signedPut: true,
    anonymousReadDenied: true,
    signedReadMatched: true,
    signedDelete: true,
    postDeleteNotFound: true,
  });
  assert.equal(calls.length, 5);
  assert.equal(calls[0].init.method, 'PUT');
  assert.match(calls[0].init.headers.authorization, /^AWS4-HMAC-SHA256 /);
  assert.equal(calls[1].init.method, 'GET');
  assert.equal(calls[1].init.headers.authorization, undefined);
  assert.equal(calls[2].init.method, 'GET');
  assert.match(calls[2].init.headers.authorization, /^AWS4-HMAC-SHA256 /);
  assert.equal(calls[3].init.method, 'DELETE');
  assert.equal(calls[4].init.method, 'GET');
  assert.equal(JSON.stringify(artifact).includes(base.accessKeyId), false);
  assert.equal(JSON.stringify(artifact).includes(base.secretAccessKey), false);
  assert.equal(JSON.stringify(artifact).includes(base.bucket), false);
  assert.equal(JSON.stringify(artifact).includes(base.endpoint), false);
});

test('fails closed when the disposable object is anonymously readable and cleans it up', async () => {
  const calls = [];
  const queue = [response(200), response(200), response(204)];
  await assert.rejects(
    () => runObjectStorageProviderSmoke({
      ...base,
      async fetchImpl(url, init) {
        calls.push({ url: String(url), init });
        return queue.shift();
      },
    }),
    /allowed anonymous object retrieval/,
  );
  assert.equal(calls.at(-1).init.method, 'DELETE');
  assert.match(calls.at(-1).init.headers.authorization, /^AWS4-HMAC-SHA256 /);
});

test('fails when downloaded bytes do not match and still attempts cleanup', async () => {
  const calls = [];
  const queue = [response(200), response(403), response(200, Buffer.alloc(32, 0x33)), response(204)];
  await assert.rejects(
    () => runObjectStorageProviderSmoke({
      ...base,
      async fetchImpl(url, init) {
        calls.push({ url: String(url), init });
        return queue.shift();
      },
    }),
    /bytes that differ/,
  );
  assert.equal(calls.at(-1).init.method, 'DELETE');
});

test('rejects non-HTTPS storage endpoints before any request', async () => {
  let called = false;
  await assert.rejects(
    () => runObjectStorageProviderSmoke({
      ...base,
      endpoint: 'http://storage.example.com',
      async fetchImpl() {
        called = true;
        return response(500);
      },
    }),
    /canonical HTTPS/,
  );
  assert.equal(called, false);
});

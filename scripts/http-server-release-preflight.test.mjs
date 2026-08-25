import assert from 'node:assert/strict';
import test from 'node:test';
import { validateHttpServerReleasePolicy } from './http-server-release-preflight.mjs';

const valid = {
  API_REQUEST_TIMEOUT_MS: '30000',
  API_HEADERS_TIMEOUT_MS: '15000',
  API_KEEP_ALIVE_TIMEOUT_MS: '5000',
};

test('accepts a coherent explicit market-release timeout policy', () => {
  assert.deepEqual(validateHttpServerReleasePolicy(valid), {
    requestTimeoutMs: 30000,
    headersTimeoutMs: 15000,
    keepAliveTimeoutMs: 5000,
  });
});

test('requires every release timeout value explicitly', () => {
  for (const name of Object.keys(valid)) {
    const env = { ...valid };
    delete env[name];
    assert.throws(() => validateHttpServerReleasePolicy(env), new RegExp(`${name} is required`));
  }
});

test('rejects non-canonical integer representations', () => {
  assert.throws(
    () => validateHttpServerReleasePolicy({ ...valid, API_REQUEST_TIMEOUT_MS: '030000' }),
    /canonical positive integer/,
  );
  assert.throws(
    () => validateHttpServerReleasePolicy({ ...valid, API_HEADERS_TIMEOUT_MS: '1.5' }),
    /canonical positive integer/,
  );
  assert.throws(
    () => validateHttpServerReleasePolicy({ ...valid, API_KEEP_ALIVE_TIMEOUT_MS: '0' }),
    /canonical positive integer/,
  );
});

test('enforces bounded values', () => {
  assert.throws(
    () => validateHttpServerReleasePolicy({ ...valid, API_REQUEST_TIMEOUT_MS: '120001' }),
    /between 5000 and 120000/,
  );
  assert.throws(
    () => validateHttpServerReleasePolicy({ ...valid, API_HEADERS_TIMEOUT_MS: '999' }),
    /between 1000 and 60000/,
  );
  assert.throws(
    () => validateHttpServerReleasePolicy({ ...valid, API_KEEP_ALIVE_TIMEOUT_MS: '30001' }),
    /between 1000 and 30000/,
  );
});

test('rejects headers timeout above total request timeout', () => {
  assert.throws(
    () =>
      validateHttpServerReleasePolicy({
        API_REQUEST_TIMEOUT_MS: '10000',
        API_HEADERS_TIMEOUT_MS: '11000',
        API_KEEP_ALIVE_TIMEOUT_MS: '5000',
      }),
    /less than or equal to API_REQUEST_TIMEOUT_MS/,
  );
});

test('rejects keep-alive timeout that is not lower than request timeout', () => {
  assert.throws(
    () =>
      validateHttpServerReleasePolicy({
        API_REQUEST_TIMEOUT_MS: '10000',
        API_HEADERS_TIMEOUT_MS: '8000',
        API_KEEP_ALIVE_TIMEOUT_MS: '10000',
      }),
    /lower than API_REQUEST_TIMEOUT_MS/,
  );
});

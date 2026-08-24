import assert from 'node:assert/strict';
import test from 'node:test';
import { validateApiRateLimitReleaseEnvironment } from './api-rate-limit-release-preflight.mjs';

function validEnv() {
  return {
    API_RATE_LIMIT_TTL_MS: '60000',
    API_RATE_LIMIT_LIMIT: '120',
    API_INSTANCE_COUNT: '1',
  };
}

test('accepts explicit bounded API rate-limit policy for one API instance', () => {
  assert.deepEqual(validateApiRateLimitReleaseEnvironment(validEnv()), {
    ok: true,
    errors: [],
  });
});

test('requires both API rate-limit values for market release', () => {
  for (const key of ['API_RATE_LIMIT_TTL_MS', 'API_RATE_LIMIT_LIMIT']) {
    const env = validEnv();
    delete env[key];
    const result = validateApiRateLimitReleaseEnvironment(env);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes(key)));
  }
});

test('requires explicit API instance count for market release', () => {
  const env = validEnv();
  delete env.API_INSTANCE_COUNT;
  const result = validateApiRateLimitReleaseEnvironment(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('API_INSTANCE_COUNT')));
  assert.ok(result.errors.some((error) => error.includes('process-local')));
});

test('rejects horizontal scaling while throttling storage is process-local', () => {
  for (const API_INSTANCE_COUNT of ['0', '2', '3', '10', '-1', '1.5', '01', 'many']) {
    const result = validateApiRateLimitReleaseEnvironment({
      ...validEnv(),
      API_INSTANCE_COUNT,
    });
    assert.equal(result.ok, false, `expected API_INSTANCE_COUNT=${API_INSTANCE_COUNT} to fail`);
    assert.ok(result.errors.some((error) => error.includes('API_INSTANCE_COUNT')));
  }
});

test('rejects non-canonical or out-of-range API rate-limit values', () => {
  for (const [key, values] of [
    ['API_RATE_LIMIT_TTL_MS', ['0', '999', '3600001', '1.5', '-1', 'minute']],
    ['API_RATE_LIMIT_LIMIT', ['0', '100001', '1.5', '-1', 'many']],
  ]) {
    for (const value of values) {
      const env = validEnv();
      env[key] = value;
      const result = validateApiRateLimitReleaseEnvironment(env);
      assert.equal(result.ok, false, `expected ${key}=${value} to fail`);
      assert.ok(result.errors.some((error) => error.includes(key)));
    }
  }
});

test('accepts documented lower and upper rate-limit bounds with one API instance', () => {
  for (const [ttl, limit] of [
    ['1000', '1'],
    ['3600000', '100000'],
  ]) {
    assert.deepEqual(
      validateApiRateLimitReleaseEnvironment({
        API_RATE_LIMIT_TTL_MS: ttl,
        API_RATE_LIMIT_LIMIT: limit,
        API_INSTANCE_COUNT: '1',
      }),
      { ok: true, errors: [] },
    );
  }
});

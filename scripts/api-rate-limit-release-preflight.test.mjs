import assert from 'node:assert/strict';
import test from 'node:test';
import { validateApiRateLimitReleaseEnvironment } from './api-rate-limit-release-preflight.mjs';

function validEnv() {
  return {
    API_RATE_LIMIT_TTL_MS: '60000',
    API_RATE_LIMIT_LIMIT: '120',
  };
}

test('accepts explicit bounded API rate-limit policy', () => {
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

test('accepts documented lower and upper bounds', () => {
  for (const [ttl, limit] of [
    ['1000', '1'],
    ['3600000', '100000'],
  ]) {
    assert.deepEqual(
      validateApiRateLimitReleaseEnvironment({
        API_RATE_LIMIT_TTL_MS: ttl,
        API_RATE_LIMIT_LIMIT: limit,
      }),
      { ok: true, errors: [] },
    );
  }
});

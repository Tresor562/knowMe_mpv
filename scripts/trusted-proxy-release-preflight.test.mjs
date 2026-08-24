import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTrustedProxyReleaseEnvironment } from './trusted-proxy-release-preflight.mjs';

test('trusted proxy release preflight requires explicit configuration', () => {
  const result = validateTrustedProxyReleaseEnvironment({});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /TRUSTED_PROXY_HOPS must be explicitly configured/);
});

test('trusted proxy release preflight accepts bounded canonical values', () => {
  for (const TRUSTED_PROXY_HOPS of ['0', '1', '2', '5']) {
    assert.deepEqual(validateTrustedProxyReleaseEnvironment({ TRUSTED_PROXY_HOPS }), { ok: true, errors: [] });
  }
});

test('trusted proxy release preflight rejects ambiguous or unsafe values', () => {
  for (const TRUSTED_PROXY_HOPS of ['-1', '6', '1.5', 'all', '1,2']) {
    const result = validateTrustedProxyReleaseEnvironment({ TRUSTED_PROXY_HOPS });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /integer between 0 and 5/);
  }
});

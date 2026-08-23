import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldClearGuestCredentialAfterRevocationFailure } from './guest-revocation-model.ts';

test('an invalid or expired Guest credential can be cleared locally after server 401', () => {
  assert.equal(shouldClearGuestCredentialAfterRevocationFailure(401), true);
});

test('transient and server failures retain the Guest credential so revocation can be retried', () => {
  assert.equal(shouldClearGuestCredentialAfterRevocationFailure(undefined), false);
  assert.equal(shouldClearGuestCredentialAfterRevocationFailure(408), false);
  assert.equal(shouldClearGuestCredentialAfterRevocationFailure(429), false);
  assert.equal(shouldClearGuestCredentialAfterRevocationFailure(500), false);
  assert.equal(shouldClearGuestCredentialAfterRevocationFailure(503), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canCreateMobileGuest,
  parseQuickMathAnswer,
  shouldRecoverAuthoritativeState
} from './guest-quick-math-model.ts';

test('mobile Guest creation requires an age gate choice and explicit temporary-session confirmation', () => {
  assert.equal(canCreateMobileGuest({ ageGateState: null, temporaryConfirmed: true }), false);
  assert.equal(canCreateMobileGuest({ ageGateState: 'ADULT', temporaryConfirmed: false }), false);
  assert.equal(canCreateMobileGuest({ ageGateState: 'MINOR_ALLOWED', temporaryConfirmed: true }), true);
});

test('Quick Math accepts only safe integer answers', () => {
  assert.equal(parseQuickMathAnswer(' 12 '), 12);
  assert.equal(parseQuickMathAnswer('-4'), -4);
  assert.equal(parseQuickMathAnswer('4.5'), null);
  assert.equal(parseQuickMathAnswer('4x'), null);
  assert.equal(parseQuickMathAnswer(''), null);
  assert.equal(parseQuickMathAnswer('999999999999999999999999'), null);
});

test('uncertain mobile actions only recover state when the authoritative sequence advanced', () => {
  assert.equal(shouldRecoverAuthoritativeState(2, 3), true);
  assert.equal(shouldRecoverAuthoritativeState(2, 2), false);
  assert.equal(shouldRecoverAuthoritativeState(3, 2), false);
});

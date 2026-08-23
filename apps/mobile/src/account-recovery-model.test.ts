import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GENERIC_ACCOUNT_RECOVERY_MESSAGE,
  isRecoveryEmailReady,
  normalizeRecoveryEmail
} from './account-recovery-model.ts';

test('recovery request normalizes only surrounding whitespace', () => {
  assert.equal(normalizeRecoveryEmail('  User@Example.com  '), 'User@Example.com');
});

test('recovery entry rejects obviously incomplete or oversized addresses locally', () => {
  assert.equal(isRecoveryEmailReady('user@example.com'), true);
  assert.equal(isRecoveryEmailReady('not-an-email'), false);
  assert.equal(isRecoveryEmailReady(`${'a'.repeat(310)}@example.com`), false);
});

test('success copy is deliberately account-enumeration neutral', () => {
  assert.match(GENERIC_ACCOUNT_RECOVERY_MESSAGE, /Si un compte correspond/);
  assert.doesNotMatch(GENERIC_ACCOUNT_RECOVERY_MESSAGE, /compte existe/i);
  assert.doesNotMatch(GENERIC_ACCOUNT_RECOVERY_MESSAGE, /compte introuvable/i);
});

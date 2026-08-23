import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveInitialMobileEntry, selectMobileEntry } from './mobile-entry-model.ts';

test('authenticated users skip the public choice screen', () => {
  assert.equal(resolveInitialMobileEntry(true), 'account');
});

test('unauthenticated users receive value-before-registration choices', () => {
  assert.equal(resolveInitialMobileEntry(false), 'choice');
  assert.equal(selectMobileEntry('choice', 'guest'), 'guest');
  assert.equal(selectMobileEntry('choice', 'account'), 'account');
});

test('guest users can return to the public choice screen', () => {
  assert.equal(selectMobileEntry('guest', 'choice'), 'choice');
});

test('account mode cannot be silently downgraded to the unauthenticated choice', () => {
  assert.equal(selectMobileEntry('account', 'choice'), 'account');
});

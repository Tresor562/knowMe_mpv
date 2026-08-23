import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reconcileMobileEntrySession,
  resolveInitialMobileEntry,
  selectMobileEntry
} from './mobile-entry-model.ts';

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

test('explicit account session loss returns account mode to the public choice', () => {
  assert.equal(reconcileMobileEntrySession('account', false), 'choice');
});

test('session reconciliation does not interrupt guest or public choice modes', () => {
  assert.equal(reconcileMobileEntrySession('guest', false), 'guest');
  assert.equal(reconcileMobileEntrySession('choice', false), 'choice');
});

test('session presence alone does not silently replace a user-selected mode', () => {
  assert.equal(reconcileMobileEntrySession('choice', true), 'choice');
  assert.equal(reconcileMobileEntrySession('guest', true), 'guest');
  assert.equal(reconcileMobileEntrySession('account', true), 'account');
});

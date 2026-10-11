import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProfileUsername } from './profile-navigation-model.ts';

test('resolves usernames and mentions into the same public profile', () => {
  assert.equal(normalizeProfileUsername(' alice_01 '), 'alice_01');
  assert.equal(normalizeProfileUsername('@alice_01'), 'alice_01');
});

test('rejects missing or untrusted profile destinations', () => {
  for (const input of ['', ' @ ', '../admin', 'name/with/slash', 'ab', null, undefined]) {
    assert.equal(normalizeProfileUsername(input), null);
  }
});

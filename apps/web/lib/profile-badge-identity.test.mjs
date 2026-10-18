import assert from 'node:assert/strict';
import test from 'node:test';
import { badgeUsernameKey, badgesForProfile } from './profile-badge-identity.ts';

const a = [{ key: 'gold', symbol: 'star' }];
const b = [{ key: 'blue', symbol: 'check' }];
const cache = new Map([['alice', a], ['bob', b]]);

test('normalizes handle syntax without changing identity', () => {
  assert.equal(badgeUsernameKey('  @ALICE  '), 'alice');
  assert.equal(badgeUsernameKey('bob'), 'bob');
});

test('a reused component may never show Alice badges for Bob', () => {
  assert.deepEqual(badgesForProfile('bob', {username:'alice',badges:a},cache),b);
  assert.deepEqual(badgesForProfile('charlie', {username:'alice',badges:a},cache),[]);
});

test('a matching fresh server snapshot has priority over cached values', () => {
  assert.deepEqual(badgesForProfile('@Bob',{username:'bob',badges:[]},cache),[]);
  assert.deepEqual(badgesForProfile('ALICE',{username:'alice',badges:a},new Map()),a);
});

test('empty target username cannot inherit any other account badges', () => {
  assert.deepEqual(badgesForProfile('  ',{username:'alice',badges:a},cache),[]);
});

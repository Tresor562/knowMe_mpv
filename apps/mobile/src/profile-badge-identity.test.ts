import assert from 'node:assert/strict';
import test from 'node:test';
import { badgeIdentityKey, badgesForAndroidProfile } from './profile-badge-identity.ts';

const golden=[{key:'gold',symbol:'star'}];
const blue=[{key:'blue',symbol:'check'}];
const cache=new Map([['first',golden],['second',blue]]);

test('Android badge owner normalizes case and profile handles',()=>{
  assert.equal(badgeIdentityKey(' @FiRsT  '),'first');
});

test('reused Android profile component never leaks badges of previous account',()=>{
  assert.deepEqual(badgesForAndroidProfile('second',{username:'first',badges:golden},cache),blue);
  assert.deepEqual(badgesForAndroidProfile('third',{username:'first',badges:golden},cache),[]);
});

test('empty server response for current profile supersedes any cached badges',()=>{
  assert.deepEqual(badgesForAndroidProfile('first',{username:'first',badges:[]},cache),[]);
});

test('empty username never inherits earlier profiles badges',()=>{
  assert.deepEqual(badgesForAndroidProfile('',{username:'first',badges:golden},cache),[]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCreatorFollowMutation, creatorFollowAction } from './creator-follow-state.ts';

test('a previously followed creator displays unfollow instead of a second follow', () => {
  assert.equal(creatorFollowAction(true, {following: true, isOwner: false, followerCount: 18}), 'unfollow');
  assert.equal(creatorFollowAction(true, {following: false, isOwner: false, followerCount: 18}), 'follow');
});

test('owner and guests cannot execute a follow mutation from the public page', () => {
  assert.equal(creatorFollowAction(true, {following: false, isOwner: true, followerCount: 18}), 'owner');
  assert.equal(creatorFollowAction(false, null), 'login');
  assert.equal(creatorFollowAction(true, null), 'refresh');
});

test('server replays never double-increment or decrement creator counts', () => {
  const s={following:false,isOwner:false,followerCount:18};
  assert.deepEqual(applyCreatorFollowMutation(s,{following:true,replayed:false}),
    {following:true,isOwner:false,followerCount:19});
  assert.equal(applyCreatorFollowMutation(s,{following:true,replayed:true}).followerCount,18);
  assert.equal(applyCreatorFollowMutation({...s,followerCount:0,following:true},
    {following:false,replayed:false}).followerCount,0);
});

test('ownership is not mutated regardless of a replayed server event',()=>{
  const s={following:false,isOwner:true,followerCount:300};
  assert.deepEqual(applyCreatorFollowMutation(s,{following:true,replayed:false}),s);
});

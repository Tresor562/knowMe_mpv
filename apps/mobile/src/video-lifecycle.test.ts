import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {shouldSuspendVideo} from './video-lifecycle.ts';
import {reelsFeedState,chooseVisibleReel} from './reels-feed-state.ts';
test('player suspends on background or inactive and preserves manual pause',()=>{
  assert.equal(shouldSuspendVideo(false,'active'),false);
  assert.equal(shouldSuspendVideo(false,'inactive'),true);
  assert.equal(shouldSuspendVideo(false,'background'),true);
  assert.equal(shouldSuspendVideo(true,'active'),true);
  assert.equal(shouldSuspendVideo(true,'background'),true);
  assert.equal(shouldSuspendVideo(false,null),false);
});

test('Reels do not confuse network failure with a genuinely empty feed',()=>{
  assert.equal(reelsFeedState({clips:0,posts:0,loading:true,failed:false,hasMore:true}),'loading');
  assert.equal(reelsFeedState({clips:0,posts:0,loading:false,failed:true,hasMore:true}),'failed');
  assert.equal(reelsFeedState({clips:0,posts:0,loading:false,failed:false,hasMore:false}),'empty');
});

test('Reels offer explicit search for video clips when legacy posts are all text',()=>{
  assert.equal(reelsFeedState({clips:0,posts:20,loading:false,failed:false,hasMore:true}),'browse');
  assert.equal(reelsFeedState({clips:0,posts:20,loading:false,failed:false,hasMore:false}),'empty');
  assert.equal(reelsFeedState({clips:2,posts:20,loading:false,failed:true,hasMore:true}),'ready');
});

test('refresh preserves a known clip and selects first when the old Reel disappears',()=>{
  assert.equal(chooseVisibleReel(['clip-a','clip-b','clip-c'],'clip-b'),'clip-b');
  assert.equal(chooseVisibleReel(['clip-x','clip-y'],'clip-b'),'clip-x');
  assert.equal(chooseVisibleReel(['clip-x','clip-y'],null),'clip-x');
  assert.equal(chooseVisibleReel([],null),null);
  assert.equal(chooseVisibleReel([],'clip-a'),null);
});

import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {shouldSuspendVideo} from './video-lifecycle.ts';
test('player suspends on background or inactive and preserves manual pause',()=>{
  assert.equal(shouldSuspendVideo(false,'active'),false);
  assert.equal(shouldSuspendVideo(false,'inactive'),true);
  assert.equal(shouldSuspendVideo(false,'background'),true);
  assert.equal(shouldSuspendVideo(true,'active'),true);
  assert.equal(shouldSuspendVideo(true,'background'),true);
  assert.equal(shouldSuspendVideo(false,null),false);
});

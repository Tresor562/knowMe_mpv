import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {videoTime} from './video-time.ts';

test('video clock never wraps after 59m59s, including five-hour videos',()=>{
  assert.equal(videoTime(0),'0:00');
  assert.equal(videoTime(61000),'1:01');
  assert.equal(videoTime(3599000),'59:59');
  assert.equal(videoTime(3600000),'1:00:00');
  assert.equal(videoTime(7202000),'2:00:02');
  assert.equal(videoTime(18000000),'5:00:00');
  assert.equal(videoTime(-1),'0:00');
  assert.equal(videoTime(Number.NaN),'0:00');
});

import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {publicPostVideoId,offlinePublicVideoFilename} from './offline-public-video-model.ts';

test('offline public video names cannot escape the app sandbox',()=>{
  assert.equal(publicPostVideoId('/media/public/post/aB_98-22'),'aB_98-22');
  assert.equal(offlinePublicVideoFilename('aB_98-22'),'aB_98-22.mp4');
  assert.equal(publicPostVideoId('/media/public/post/../secret'),null);
  assert.equal(publicPostVideoId('https://external.example/mp4'),null);
  assert.equal(publicPostVideoId('/media/public/post/id?token=1'),null);
  assert.equal(publicPostVideoId('/media/public/post/id/extra'),null);
  assert.equal(publicPostVideoId('/media/public/post/'+('x'.repeat(129))),null);
  assert.throws(()=>offlinePublicVideoFilename('../secret'));
});

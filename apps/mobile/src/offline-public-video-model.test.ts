import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {publicPostVideoId,offlinePublicVideoFilename} from './offline-public-video-model.ts';
import {sortOfflineVideos,totalOfflineVideoBytes,offlineStorageLabel} from './offline-video-library-model.ts';

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

test('offline library sorts copies without mutating source and computes total storage',()=>{
  const list=[
    {url:'/media/public/post/alpha',uri:'file://alpha',bytes:2_000_000,modifiedAt:200},
    {url:'/media/public/post/beta',uri:'file://beta',bytes:5_000_000,modifiedAt:100},
    {url:'/media/public/post/gamma',uri:'file://gamma',bytes:1_000_000,modifiedAt:300}
  ];
  assert.deepEqual(sortOfflineVideos(list,'recent').map(v=>v.url),
    ['/media/public/post/gamma','/media/public/post/alpha','/media/public/post/beta']);
  assert.deepEqual(sortOfflineVideos(list,'oldest').map(v=>v.url),
    ['/media/public/post/beta','/media/public/post/alpha','/media/public/post/gamma']);
  assert.deepEqual(sortOfflineVideos(list,'largest').map(v=>v.bytes),
    [5_000_000,2_000_000,1_000_000]);
  assert.equal(list[0]?.url,'/media/public/post/alpha');
  assert.equal(totalOfflineVideoBytes(list),8_000_000);
});

test('offline usage handles large files, invalid measurements and both languages',()=>{
  assert.match(offlineStorageLabel(5*1024*1024*1024,'fr'),/Go$/);
  assert.match(offlineStorageLabel(500*1024*1024,'en'),/Mo$/);
  assert.equal(offlineStorageLabel(Number.NaN,'fr').endsWith('Mo'),true);
  assert.equal(totalOfflineVideoBytes([{url:'a',uri:'a',bytes:Number.NaN,modifiedAt:0}]),0);
});

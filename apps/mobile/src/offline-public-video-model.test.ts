import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {publicPostVideoId,offlinePublicVideoFilename} from './offline-public-video-model.ts';
import {sortOfflineVideos,totalOfflineVideoBytes} from './offline-video-library-model.ts';
import {offlineVideoLabels,offlineVideoSize} from './offline-video-labels.ts';

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

test('offline library has localized error and action copy with correct counts',()=>{
  const fr=offlineVideoLabels('fr');
  const en=offlineVideoLabels('en');
  assert.equal(fr.available(0),'0 vidéos disponibles hors connexion');
  assert.equal(fr.available(1),'1 vidéo disponible hors connexion');
  assert.equal(en.available(1),'1 video available offline');
  assert.equal(en.available(3),'3 videos available offline');
  assert.equal(fr.remove(2),'Supprimer la vidéo hors ligne 2');
  assert.equal(en.remove(2),'Delete offline video 2');
  assert.equal(fr.sizeUnit,'Mo');
  assert.equal(en.sizeUnit,'MB');
  assert.match(en.emptyMessage,/Offline/i);
  assert.match(fr.emptyMessage,/Hors ligne/);
});

test('offline library defaults to French for an unexpected locale',()=>{
  assert.equal(offlineVideoLabels('unknown').close,offlineVideoLabels('fr').close);
});

test('large offline videos show practical bilingual GB sizes with safe bounds',()=>{
  assert.equal(offlineVideoSize(5*1024**3,'fr'),'5.0 Go');
  assert.equal(offlineVideoSize(5*1024**3,'en'),'5.0 GB');
  assert.equal(offlineVideoSize(800*1024**2,'fr'),'800.0 Mo');
  assert.equal(offlineVideoSize(800*1024**2,'en'),'800.0 MB');
  assert.equal(offlineVideoSize(-100,'fr'),'0.0 Mo');
  assert.equal(offlineVideoSize(Number.NaN,'en'),'0.0 MB');
  assert.equal(offlineVideoLabels('en').storage,'Storage');
  assert.equal(offlineVideoLabels('fr').storage,'Stockage');
});

test('offline library local sorting never modifies the original copy list',()=>{
  const values=[
    {url:'/media/public/post/alpha',uri:'file://alpha',bytes:2_000_000,modifiedAt:200},
    {url:'/media/public/post/beta',uri:'file://beta',bytes:5_000_000,modifiedAt:100},
    {url:'/media/public/post/gamma',uri:'file://gamma',bytes:1_000_000,modifiedAt:300}
  ];
  assert.deepEqual(sortOfflineVideos(values,'recent').map(v=>v.url),
    ['/media/public/post/gamma','/media/public/post/alpha','/media/public/post/beta']);
  assert.deepEqual(sortOfflineVideos(values,'oldest').map(v=>v.url),
    ['/media/public/post/beta','/media/public/post/alpha','/media/public/post/gamma']);
  assert.deepEqual(sortOfflineVideos(values,'largest').map(v=>v.bytes),
    [5_000_000,2_000_000,1_000_000]);
  assert.equal(values[0]?.url,'/media/public/post/alpha');
  assert.equal(totalOfflineVideoBytes(values),8_000_000);
});

test('offline storage summaries ignore bad file metadata',()=>{
  assert.equal(totalOfflineVideoBytes([{url:'a',uri:'a',bytes:NaN,modifiedAt:0}]),0);
  assert.equal(totalOfflineVideoBytes([{url:'a',uri:'a',bytes:-500,modifiedAt:0}]),0);
});

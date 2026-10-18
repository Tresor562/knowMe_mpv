import assert from 'node:assert/strict';
import test from 'node:test';
import {safeSharedLink,linksInMessage,contentKind,appendSharedMessages,filterSharedContent,searchSharedMessages} from './group-shared-content-model.ts';

const item = (id, kind, content='') => ({
  id, conversationId:'group-1', content, createdAt:'2026-10-18T16:00:00Z',
  presentation: kind ? {kind, assetId:'asset-' + id} : undefined
});
test('media / files categories reflect real message assets', () => {
  assert.deepEqual(contentKind(item('1','IMAGE')),['media']);
  assert.deepEqual(contentKind(item('2','VIDEO')),['media']);
  assert.deepEqual(contentKind(item('3','GIF')),['media']);
  assert.deepEqual(contentKind(item('4','DOCUMENT')),['files']);
  assert.deepEqual(contentKind(item('5','AUDIO')),['files']);
  assert.deepEqual(contentKind(item('6','STICKER')),[]);
});
test('only public http links are allowed and duplicates removed', () => {
  assert.equal(safeSharedLink('javascript:alert(1)'),null);
  assert.equal(safeSharedLink('data:text/html,evil'),null);
  assert.equal(safeSharedLink('https://user:pass@example.com/file'),null);
  assert.equal(safeSharedLink('https://example.com/a'), 'https://example.com/a');
  const links=linksInMessage('Voir https://example.com/a, https://example.com/a et http://example.org/file.');
  assert.deepEqual(links.map(v=>v.url),['https://example.com/a','http://example.org/file']);
  assert.deepEqual(contentKind(item('1',null,'Regarde https://example.com')),['links']);
});
test('pagination deduplicates without mutating previous result', () => {
  const a=[item('old','IMAGE')];
  const b=appendSharedMessages(a,[item('old','IMAGE'),item('new','AUDIO')]);
  assert.deepEqual(b.map(x=>x.id),['old','new']);
  assert.equal(a.length,1);
});

test('progressive group search finds accents, authors and document names',()=>{
  const items=[
    {...item('1','TEXT','Révisions de mathématiques'),sender:{displayName:'Zoé'}},
    {...item('2','DOCUMENT'),presentation:{kind:'DOCUMENT',assetId:'file',fileName:'Résumé.pdf'}},
    {...item('3','TEXT','Événement de lundi'),sender:{displayName:'Alice'}}
  ];
  assert.deepEqual(searchSharedMessages(items,'MATHEMATIQUES').map(x=>x.id),['1']);
  assert.deepEqual(searchSharedMessages(items,'Zoe').map(x=>x.id),['1']);
  assert.deepEqual(searchSharedMessages(items,'resume').map(x=>x.id),['2']);
  assert.deepEqual(searchSharedMessages(items,'').map(x=>x.id),[]);
});

test('private and group shared tabs filter actual media kinds without mixing files', () => {
  const all=[item('img','IMAGE'),item('video','VIDEO'),item('gif','GIF'),
    item('sticker','STICKER_IMAGE'),item('doc','DOCUMENT'),item('audio','AUDIO')];
  assert.deepEqual(filterSharedContent(all,'media').map(x=>x.id),['img','video','gif','sticker']);
  assert.deepEqual(filterSharedContent(all,'media','IMAGE').map(x=>x.id),['img']);
  assert.deepEqual(filterSharedContent(all,'media','VIDEO').map(x=>x.id),['video']);
  assert.deepEqual(filterSharedContent(all,'files').map(x=>x.id),['doc','audio']);
  assert.deepEqual(filterSharedContent(all,'files','DOCUMENT').map(x=>x.id),['doc']);
  assert.deepEqual(filterSharedContent(all,'files','AUDIO').map(x=>x.id),['audio']);
});

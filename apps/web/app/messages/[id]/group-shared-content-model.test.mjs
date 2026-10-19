import assert from 'node:assert/strict';
import test from 'node:test';
import {safeSharedLink,linksInMessage,contentKind,appendSharedMessages,filterSharedContent,searchSharedMessages,filterSharedHistory,sharedAuthorOptions,sharedLocalDate} from './group-shared-content-model.ts';

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

test('author selection is identity-specific and options have readable names',()=>{
  const rows=[
    {...item('a','IMAGE'),sender:{id:'u-1',displayName:'Alice',username:'alice'}},
    {...item('b','IMAGE'),sender:{id:'u-2',displayName:'Alice',username:'alice2'}},
    {...item('c','IMAGE'),sender:{id:'u-1',displayName:'Alice',username:'alice'}}
  ];
  assert.deepEqual(sharedAuthorOptions(rows).map(x=>x.key),['id:u-1','id:u-2']);
  assert.deepEqual(filterSharedHistory(rows,{kind:'media',author:'id:u-2'}).map(x=>x.id),['b']);
  assert.equal(rows.length,3);
});

test('inclusive dates and order use the viewer local calendar, not string substrings',()=>{
  const rows=[
    {...item('old','DOCUMENT'),createdAt:'2026-09-30T12:00:00Z'},
    {...item('middle','DOCUMENT'),createdAt:'2026-10-05T12:00:00Z'},
    {...item('new','DOCUMENT'),createdAt:'2026-10-18T12:00:00Z'}
  ];
  assert.deepEqual(filterSharedHistory(rows,{kind:'files',fromDate:'2026-10-05',toDate:'2026-10-18'})
    .map(x=>x.id),['new','middle']);
  assert.deepEqual(filterSharedHistory(rows,{kind:'files',fromDate:'2026-10-05',sort:'oldest'})
    .map(x=>x.id),['middle','new']);
  assert.deepEqual(filterSharedHistory(rows,{kind:'files',toDate:'2026-09-30'})
    .map(x=>x.id),['old']);
  assert.equal(sharedLocalDate('garbled timestamp'),'');
  assert.equal(filterSharedHistory(rows,{kind:'files',fromDate:'2026-02-30'}).length,3);
});

test('date and author filters compose with full text queries on loaded messages only',()=>{
  const messages=[
    {...item('1','TEXT','Résumé du cours'),createdAt:'2026-10-12T12:00:00Z',
      sender:{username:'zoe',displayName:'Zoé'}},
    {...item('2','TEXT','Résumé d’histoire'),createdAt:'2026-10-14T12:00:00Z',
      sender:{username:'ali',displayName:'Ali'}},
    {...item('3','TEXT','Notes de maths'),createdAt:'2026-10-15T12:00:00Z',
      sender:{username:'zoe',displayName:'Zoé'}}
  ];
  assert.deepEqual(filterSharedHistory(messages,{
    kind:'search',query:'resume',author:'username:zoe',fromDate:'2026-10-12',toDate:'2026-10-15'
  }).map(x=>x.id),['1']);
  assert.deepEqual(filterSharedHistory(messages,{kind:'search',query:'absent'}),[]);
});

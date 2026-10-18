import assert from 'node:assert/strict';
import test from 'node:test';
import { messageSelectionLinks, selectVisibleMessageIds } from './shared-content-selection.ts';

const m=(id, conversationId='chat')=>({id,conversationId,content:'',createdAt:'2026-10-18T15:00:00Z'});
test('only currently visible authorized messages in the same conversation yield links',()=>{
  const items=[m('visible'),m('elsewhere','other'),m('second')];
  const urls=messageSelectionLinks('chat',['visible','hidden','elsewhere','visible','second'],items,'https://knowme-nextech.vercel.app');
  assert.deepEqual(urls,[
    'https://knowme-nextech.vercel.app/messages/chat?message=visible',
    'https://knowme-nextech.vercel.app/messages/chat?message=second'
  ]);
});
test('special characters are safely URL-encoded and bound to same origin',()=>{
  const result=messageSelectionLinks('group/a',['msg?1'],[m('msg?1','group/a')],'https://example.test');
  assert.deepEqual(result,['https://example.test/messages/group%2Fa?message=msg%3F1']);
});
test('selection is bounded to fifty distinct messages',()=>{
  const visible=Array.from({length:80},(_,n)=>m(String(n)));
  const result=messageSelectionLinks('chat',visible.map(x=>x.id),visible,'https://example.test',1000);
  assert.equal(result.length,50);
  assert.deepEqual(messageSelectionLinks('chat',[],visible,'https://example.test'),[]);
});

test('select-all ignores foreign chat items, empty IDs and duplicate history',()=>{
  const input=[m('first'),m('second'),m('other','other'),m('first'),m(''),m('third')];
  assert.deepEqual(selectVisibleMessageIds('chat',input),['first','second','third']);
  assert.deepEqual(selectVisibleMessageIds('chat',input,2),['first','second']);
  assert.deepEqual(selectVisibleMessageIds('',input),[]);
});
test('select-all respects the fifty-item limit in a large filtered gallery',()=>{
  const input=Array.from({length:70},(_,n)=>m('msg-'+n));
  const selected=selectVisibleMessageIds('chat',input,500);
  assert.equal(selected.length,50);
  assert.deepEqual(selected.slice(0,2),['msg-0','msg-1']);
});

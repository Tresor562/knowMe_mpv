import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { storySequence, storySegments, storyStep, storyTextColor, storyAgeLabel, STORY_TEXT_COLORS } from './story-sequence-model.ts';

test('multiple stories split into equal per-author segments and do not leak another author into the rail', () => {
  const a = [
    {id:'a2',author:{id:'a'},createdAt:'2026-10-21T10:00:00Z'},
    {id:'b1',author:{id:'b'},createdAt:'2026-10-21T10:30:00Z'},
    {id:'a1',author:{id:'a'},createdAt:'2026-10-21T09:00:00Z'}
  ];
  const ordered = storySequence(a,['a','b'],a[0]!);
  assert.deepEqual(ordered.map(x=>x.id),['a1','a2','b1']);
  assert.deepEqual(storySegments(ordered,a[0]!).map(x=>x.id),['a1','a2']);
  assert.equal(storyStep(ordered,'a2',1),2);
  assert.equal(storyStep(ordered,'b1',1),-1);
  assert.equal(storyStep(ordered,'a1',-1),-1);
});
test('owner group is first, duplicates are removed and text colors cannot use arbitrary input', () => {
  const a={id:'own',author:{id:'self'},createdAt:'2026-10-21T09:00:00Z'};
  const b={id:'other',author:{id:'other'},createdAt:'2026-10-21T10:00:00Z'};
  assert.deepEqual(storySequence([a,b,a],['other','self'],a).map(x=>x.id),['own','other']);
  assert.equal(storyTextColor({color:STORY_TEXT_COLORS[2]},'anything'),STORY_TEXT_COLORS[2]);
  assert.ok(STORY_TEXT_COLORS.includes(storyTextColor({color:'url(evil)'},'test') as typeof STORY_TEXT_COLORS[number]));
});
test('the rail DTO cannot erase the creation date from the full feed', () => {
  const full={id:'story-1',author:{id:'self'},createdAt:'2026-10-23T12:00:00.000Z'};
  const rail={id:'story-1',author:{id:'self'}};
  const combined=storySequence<{id:string;author:{id:string};createdAt?:string}>([full],['self'],rail);
  assert.equal(combined.length,1);
  assert.equal(combined[0]?.createdAt,full.createdAt);
  assert.equal(storyAgeLabel(combined[0]?.createdAt,Date.parse('2026-10-23T15:00:00Z')),'Il y a 3 h');
});

test('relative Story timestamps reflect the actual stored view time',()=>{
  const now=Date.parse('2026-10-21T20:00:00Z');
  assert.equal(storyAgeLabel('2026-10-21T19:58:00Z',now),'Il y a 2 min');
  assert.equal(storyAgeLabel('2026-10-21T18:00:00Z',now),'Il y a 2 h');
  assert.equal(storyAgeLabel('2026-10-20T20:00:00Z',now),'Il y a 1 j');
  assert.equal(storyAgeLabel(undefined,now),'Date indisponible');
  assert.equal(storyAgeLabel('invalid',now),'Date indisponible');
  assert.equal(storyAgeLabel('2026-10-21T20:05:00Z',now),'Date indisponible');
});

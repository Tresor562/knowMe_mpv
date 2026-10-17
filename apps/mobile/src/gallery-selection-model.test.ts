import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeGalleryPage, toggleGallerySelection } from './gallery-selection-model.ts';

const photoA = { id:'i1', album:'Camera' };
const photoB = { id:'i2', album:'Downloads' };
const video = { id:'v3', album:'Videos' };

test('selected media remain available across album/filter changes', () => {
  const first = toggleGallerySelection([], photoA, 10);
  const second = toggleGallerySelection(first.items, photoB, 10);
  const third = toggleGallerySelection(second.items, video, 10);
  assert.deepEqual(third.items.map(item=>item.id), ['i1','i2','v3']);
  assert.equal(third.limitReached, false);
});

test('tapping selected media removes only that item and preserves order', () => {
  const selected = [photoA, photoB, video];
  assert.deepEqual(toggleGallerySelection(selected, photoB, 10).items, [photoA, video]);
});

test('selection limit never silently drops earlier photos', () => {
  const initial = [photoA, photoB];
  const attempted = toggleGallerySelection(initial, video, 2);
  assert.equal(attempted.limitReached, true);
  assert.deepEqual(attempted.items, initial);
});

test('unlimited gallery batches are allowed for messages and posts', () => {
  const many = Array.from({length:100},(_,id)=>({id:String(id)}));
  const result=toggleGallerySelection(many,{id:'101'},Infinity);
  assert.equal(result.limitReached,false);
  assert.equal(result.items.length,101);
});
test('stories still have a strict ten-media limit',()=>{
  const selected=Array.from({length:10},(_,id)=>({id:String(id)}));
  assert.equal(toggleGallerySelection(selected,{id:'11'},10).limitReached,true);
  assert.equal(toggleGallerySelection(selected,{id:'11'},10).items.length,10);
});

test('gallery pagination deduplicates repeated MediaStore rows', () => {
  assert.deepEqual(mergeGalleryPage([photoA], [photoA, photoB, photoB]), [photoA,photoB]);
});

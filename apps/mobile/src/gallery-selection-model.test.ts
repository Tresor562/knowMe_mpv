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

test('invalid limits fail safely and supported limit does not exceed ten', () => {
  const attempted = toggleGallerySelection([photoA], photoB, Number.NaN);
  assert.equal(attempted.limitReached, true);
  const many = Array.from({length:10},(_,id)=>({id:String(id)}));
  assert.equal(toggleGallerySelection(many,{id:'11'},100).limitReached,true);
});

test('gallery pagination deduplicates repeated MediaStore rows', () => {
  assert.deepEqual(mergeGalleryPage([photoA], [photoA, photoB, photoB]), [photoA,photoB]);
});

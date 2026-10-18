import assert from 'node:assert/strict';
import test from 'node:test';
import { groupStoriesByAuthor } from '../apps/web/app/feed/story-rail-model.ts';

const s = (id, authorId, own = false) => ({
  id, author: authorId ? { id: authorId } : null, viewer: { own }
});

test('one tile per author, ordered by their latest Story in feed order', () => {
  const result = groupStoriesByAuthor([
    s('a-new', 'a'), s('b-new', 'b'), s('a-old', 'a'),
    s('b-old', 'b'), s('c-new', 'c')
  ]);
  assert.deepEqual(result.map(g => [g.story.id, g.count]), [
    ['a-new', 2], ['b-new', 2], ['c-new', 1]
  ]);
});

test('own Stories share a single tile and do not duplicate', () => {
  const result = groupStoriesByAuthor([
    s('me-new', 'me', true), s('friend', 'friend'),
    s('me-old', 'me', true)
  ]);
  assert.deepEqual(result.map(g => [g.story.id, g.count]), [
    ['me-new', 2], ['friend', 1]
  ]);
});

test('an inaccessible/unknown author cannot create a stranger tile', () => {
  const result = groupStoriesByAuthor([s('hidden', null), s('me', null, true)]);
  assert.deepEqual(result.map(g => [g.story.id, g.count]), [['me', 1]]);
});

import { storyCompletionBps, storyProgressCheckpoint } from '../apps/mobile/src/story-view-progress-model.ts';

test('Story progress is based on the actual player position, not opening the Story',()=>{
  assert.equal(storyCompletionBps(0,30_000),0);
  assert.equal(storyCompletionBps(15_000,30_000),5_000);
  assert.equal(storyCompletionBps(29_999,30_000),10_000);
  assert.equal(storyCompletionBps(12_000,0),0);
  assert.equal(storyCompletionBps(NaN,30_000),0);
  assert.equal(storyCompletionBps(9_999_999,30_000),10_000);
});

test('Story analytics emit only new progress milestones, not repeated views',()=>{
  assert.equal(storyProgressCheckpoint(0,0),null);
  assert.equal(storyProgressCheckpoint(2499,0),null);
  assert.equal(storyProgressCheckpoint(2500,0),2500);
  assert.equal(storyProgressCheckpoint(4900,2500),null);
  assert.equal(storyProgressCheckpoint(7800,2500),7500);
  assert.equal(storyProgressCheckpoint(10_000,7500),10_000);
  assert.equal(storyProgressCheckpoint(10_000,10_000),null);
  assert.equal(storyProgressCheckpoint(Infinity,0),null);
});

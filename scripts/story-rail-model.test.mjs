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

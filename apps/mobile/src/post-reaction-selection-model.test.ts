import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAVORITE_POST_REACTIONS,
  isValidPostEmojiReaction
} from './post-reaction-selection-model.ts';

test('the five quick reactions stay stable and uniquely accessible', () => {
  assert.deepEqual([...FAVORITE_POST_REACTIONS], ['❤️','😂','😮','😢','😡']);
  assert.equal(new Set(FAVORITE_POST_REACTIONS).size, 5);
});

test('emoji keyboard supports skin tones, ZWJ compositions, flags and keycaps', () => {
  for (const value of ['❤️','🫶🏾','👩‍💻','🇧🇯','1️⃣','😂']) {
    assert.equal(isValidPostEmojiReaction(value), true, value);
  }
});

test('custom reaction rejects prose, bare numerals and oversized payloads', () => {
  for (const value of ['', 'hello', '😀hello', '😀123', '😀!', '0', '💬'.repeat(33)]) {
    assert.equal(isValidPostEmojiReaction(value), false, value);
  }
});

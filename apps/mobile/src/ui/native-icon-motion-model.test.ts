import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeIconChanged, nativeIconProgress, nativeIconShouldLoop, nativeVisibleGlyph } from './native-icon-motion-model.ts';

test('native pause glyph reflects actual player state', () => {
  assert.equal(nativeVisibleGlyph('play', 'playing'), 'pause');
  assert.equal(nativeVisibleGlyph('pause', 'paused'), 'play');
  assert.equal(nativeVisibleGlyph('download', 'success'), 'check');
  assert.equal(nativeVisibleGlyph('heart', 'selected'), 'heart');
});

test('native animation loop is limited to ongoing real events', () => {
  for (const state of ['loading', 'recording', 'playing', 'typing', 'syncing', 'call-active', 'live']) {
    assert.equal(nativeIconShouldLoop(state), true);
  }
  for (const state of ['idle', 'selected', 'unselected', 'paused', 'success', 'error', 'offline', 'closed']) {
    assert.equal(nativeIconShouldLoop(state), false);
  }
});

test('native status changes animate once and do not invent progress', () => {
  const before = { name: 'bell', state: 'idle' as const, eventToken: 5 };
  assert.equal(nativeIconChanged(before, before), false);
  assert.equal(nativeIconChanged(before, { ...before, eventToken: 6 }), true);
  assert.equal(nativeIconChanged(before, { ...before, state: 'incoming' }), true);
  assert.equal(nativeIconProgress('idle', .7), null);
  assert.equal(nativeIconProgress('progress', null), null);
  assert.equal(nativeIconProgress('progress', Number.NaN), null);
  assert.equal(nativeIconProgress('progress', -.2), 0);
  assert.equal(nativeIconProgress('progress', .64), .64);
  assert.equal(nativeIconProgress('progress', 1.3), 1);
});

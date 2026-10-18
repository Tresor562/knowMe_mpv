import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampRealProgress, didIconEventChange, mayAnimateIndefinitely, presentationGlyphName
} from './icon-motion-model.ts';

test('audio glyph always reflects playback state, including after pause', () => {
  assert.equal(presentationGlyphName('play', 'playing'), 'pause');
  assert.equal(presentationGlyphName('pause', 'paused'), 'play');
  assert.equal(presentationGlyphName('pause', 'playing'), 'pause');
  assert.equal(presentationGlyphName('download', 'success'), 'check');
  assert.equal(presentationGlyphName('download', 'progress'), 'download');
});

test('transfer progress never claims numbers outside verified state', () => {
  assert.equal(clampRealProgress('idle', 0.5), null);
  assert.equal(clampRealProgress('progress', null), null);
  assert.equal(clampRealProgress('progress', NaN), null);
  assert.equal(clampRealProgress('progress', Infinity), null);
  assert.equal(clampRealProgress('progress', -3), 0);
  assert.equal(clampRealProgress('progress', 0.42), .42);
  assert.equal(clampRealProgress('progress', 3), 1);
});

test('an icon burst follows status/event changes only, not rerender', () => {
  const base = { name: 'notifications', state: 'idle', eventToken: 1 };
  assert.equal(didIconEventChange(base, { ...base }), false);
  assert.equal(didIconEventChange(base, { ...base, state: 'incoming' }), true);
  assert.equal(didIconEventChange(base, { ...base, eventToken: 2 }), true);
  assert.equal(didIconEventChange(base, { ...base, eventToken: null }), false);
});

test('indefinite motion limited to real, ongoing operation', () => {
  for (const state of ['loading','recording','playing']) {
    assert.equal(mayAnimateIndefinitely(state), true);
  }
  for (const state of ['idle','selected','paused','success','error','offline','closed']) {
    assert.equal(mayAnimateIndefinitely(state), false);
  }
});

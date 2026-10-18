import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { nativeIconChanged, nativeIconProgress, nativeIconShouldLoop, nativeVisibleGlyph } from './native-icon-motion-model.ts';

test('native pause glyph reflects actual player state', () => {
  assert.equal(nativeVisibleGlyph('play', 'playing'), 'pause');
  assert.equal(nativeVisibleGlyph('pause', 'paused'), 'play');
  assert.equal(nativeVisibleGlyph('download', 'success'), 'check');
  assert.equal(nativeVisibleGlyph('heart', 'selected'), 'heart');
  assert.equal(nativeVisibleGlyph('create', 'open'), 'close');
  assert.equal(nativeVisibleGlyph('create', 'closed'), 'create');
});

test('native animation loop is limited to ongoing real events', () => {
  for (const state of ['loading', 'recording', 'playing', 'typing', 'syncing', 'call-active', 'live'] as const) {
    assert.equal(nativeIconShouldLoop(state), true);
  }
  for (const state of ['idle', 'selected', 'unselected', 'paused', 'success', 'error', 'offline', 'closed'] as const) {
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

test('real native touch target and persistent red fill are wired to state', () => {
  const dir = import.meta.dirname;
  const control = fs.readFileSync(path.join(dir, 'KnowMeNativeIconButton.tsx'), 'utf8');
  const motion = fs.readFileSync(path.join(dir, 'KnowMeNativeAnimatedIcon.tsx'), 'utf8');
  const ui = fs.readFileSync(path.join(dir, 'KnowMeUI.tsx'), 'utf8');
  const lifecycle = fs.readFileSync(path.join(dir, 'knowme-app-foreground.ts'), 'utf8');
  assert.match(control, /width: 48, height: 48, minWidth: 48, minHeight: 48/);
  assert.match(control, /style, \{ minWidth: 48, minHeight: 48 \}/);
  assert.match(control, /onLongPress=\{onLongPress\}/);
  assert.match(control, /accessibilityLabel=\{label\}/);
  assert.match(control, /nativeIconProgress\(state, progress\)/);
  assert.match(control, /accessibilityValue=\{accessibilityValue\}/);
  assert.match(control, /Math\.round\(actualProgress \* 100\)/);
  assert.match(control, /accessibilityHint=\{onLongPress \? longPressHint : undefined\}/);
  assert.match(ui, /accessibilityValue=\{accessibilityValue\}/);

  assert.match(control, /selected: state === 'selected'/);
  assert.match(motion, /filled=\{selectedHeart\}/);
  assert.match(motion, /if \(!enabled \|\| \(!nativeIconShouldLoop\(state\) && !firstEvent\)\)/);
  assert.match(ui, /if \(name === 'heart' && filled\)/);
  assert.match(ui, /onLongPress=\{onLongPress\}/);
  assert.match(lifecycle, /listeners.size === 1/);
  assert.match(lifecycle, /AppState.addEventListener\('change'/);
  assert.match(lifecycle, /eventSubscription\?\.remove\(\)/);
  assert.match(motion, /const foreground = useKnowMeAppForeground\(\)/);
});


test('Android toast icons animate only confirmed arrivals and dismiss via 48dp accessible button', () => {
  const dir = import.meta.dirname;
  const feedback = fs.readFileSync(path.join(dir, 'KnowMeFeedback.tsx'), 'utf8');
  const motion = fs.readFileSync(path.join(dir, 'KnowMeNativeAnimatedIcon.tsx'), 'utf8');
  assert.match(feedback, /<KnowMeNativeAnimatedIcon/);
  assert.match(feedback, /eventToken=\{toastEvent\}/);
  assert.match(feedback, /setToastEvent\(n => n \+ 1\)/);
  assert.match(feedback, /<KnowMeNativeIconButton name="close"/);
  assert.match(feedback, /label="Fermer le message"/);
  assert.match(motion, /const firstEvent = eventToken !== null/);
  assert.match(motion, /state === 'incoming' \|\| state === 'success' \|\| state === 'error'/);
});

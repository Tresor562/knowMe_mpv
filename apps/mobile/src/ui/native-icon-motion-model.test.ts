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
  assert.match(motion, /filled=\{state === 'selected'\}/);
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
  assert.match(feedback, /useKnowMeAppForeground\(\)/);
  assert.match(feedback, /if \(!toast \|\| !foreground\) return;/);
  assert.match(feedback, /toast\.tone === 'error' \? 8000 : 5000/);
  assert.match(feedback, /<KnowMeNativeIconButton name="close"/);
  assert.match(feedback, /label="Fermer le message"/);
  assert.match(motion, /const firstEvent = eventToken !== null/);
  assert.match(motion, /state === 'incoming' \|\| state === 'success' \|\| state === 'error'/);
});


test('Android language selector has accessible vector close and true syncing status', () => {
  const dir = import.meta.dirname;
  const language = fs.readFileSync(path.join(dir, '..', 'LanguagePicker.tsx'), 'utf8');
  const settings = fs.readFileSync(path.join(dir, '..', 'LanguageSettingsExperience.tsx'), 'utf8');
  assert.match(language, /<KnowMeNativeIconButton name="close" size=\{20\}/);
  assert.match(language, /label=\{interfaceLocale === 'en' \? 'Close language selection' : 'Fermer le choix de langue'\}/);
  assert.match(language, /accessibilityState=\{\{ selected \}\}/);
  assert.match(language, /accessibilityLabel=\{\`\$\{item\.nativeName\} · \$\{item\.locale\}\`\}/);
  assert.match(settings, /locale === 'en' \? ' · synced' : ' · synchronisée'/);
  assert.match(language, /minHeight: 48,/);
  assert.match(language, /width: 48,\s*height: 48,/);
  assert.match(language, /<KnowMeNativeAnimatedIcon name="check"/);
  assert.doesNotMatch(language, /closeText:|>×</);
  assert.match(settings, /<KnowMeNativeAnimatedIcon name=\{busy \? 'refresh' : 'discover'\}/);
  assert.match(settings, /state=\{busy \? 'syncing' : 'idle'\}/);
});


test('Android media cache controls remain usable after a failed delete and announce selected categories', () => {
  const dir = import.meta.dirname;
  const settings = fs.readFileSync(path.join(dir, '..', 'MediaDownloadSettingsExperience.tsx'), 'utf8');
  assert.match(settings, /accessibilityRole="checkbox"/);
  assert.match(settings, /accessibilityRole="radio"/);
  assert.match(settings, /accessibilityState=\{\{ checked: selected, disabled: busy \}\}/);
  assert.match(settings, /<KnowMeNativeAnimatedIcon name=\{MEDIA_ICONS\[kind\]\}/);
  assert.match(settings, /minHeight: 48/);
  assert.match(settings, /await clearMobileMediaCache\(\)/);
  assert.match(settings, /catch \(cause\) \{\s*setMessage\(cause instanceof Error \? cause\.message : 'Suppression impossible\.'\)/);
  assert.match(settings, /finally \{\s*setBusy\(false\)/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const dir = import.meta.dirname;
const glyph = fs.readFileSync(path.join(dir, 'knowme-glyph.tsx'), 'utf8');
const navigation = fs.readFileSync(path.join(dir, 'bottom-navigation.tsx'), 'utf8');
const animated = fs.readFileSync(path.join(dir, 'knowme-animated-icon.tsx'), 'utf8');
const animatedCss = fs.readFileSync(path.join(dir, '..', 'app', 'knowme-icon-motion.css'), 'utf8');
const css = fs.readFileSync(path.join(dir, '..', 'app', 'iconography.css'), 'utf8');
const native = fs.readFileSync(path.join(dir, '..', '..', 'mobile', 'src', 'ui', 'KnowMeUI.tsx'), 'utf8');

test('each declared SVG glyph has a drawable shape', () => {
  const declared = glyph.match(/export type KnowMeGlyphName =([\s\S]*?);/)?.[1] ?? '';
  const shapes = glyph.match(/const shapes = \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  const names = [...declared.matchAll(/'([\w-]+)'/g)].map(m => m[1]);
  assert.ok(names.length >= 40);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) {
    const rx = new RegExp(`(?:^|[,\\n]\\s*)(?:'${name}'|${name}):\\s*<`);
    assert.match(shapes, rx, `missing glyph ${name}`);
  }
  assert.match(glyph, /viewBox: '0 0 24 24'/);
  assert.match(glyph, /'aria-hidden': true/);
});

test('navigation and actual connectivity consume the canonical animated glyph', () => {
  assert.match(navigation, /KnowMeAnimatedIcon/);
  assert.match(navigation, /active=\{item\.matches\.includes\(pathname\)\}/);
  const connectivity = fs.readFileSync(path.join(dir, 'network-connectivity-notice.tsx'), 'utf8');
  assert.match(connectivity, /eventToken=\{state\}/);
  assert.match(connectivity, /name=\{offline \? 'wifi-off' : 'wifi'\}/);
});

test('motion derives from data, differentiates icon roles and stops safely', () => {
  assert.match(animated, /didIconEventChange\(earlier, next\)/);
  assert.match(animated, /clampRealProgress\(state, progress\)/);
  assert.match(animated, /presentationGlyphName\(name, state\)/);
  assert.match(animated, /mayAnimateIndefinitely\(state\)/);
  assert.match(animatedCss, /km-icon-bell-ring/);
  assert.match(animatedCss, /km-icon-flight/);
  assert.match(animatedCss, /km-icon-heart-pop/);
  assert.match(animatedCss, /#ef3340/);
  assert.match(animatedCss, /prefers-reduced-motion: reduce/);
  const visibility = fs.readFileSync(path.join(dir, 'knowme-document-visibility.ts'), 'utf8');
  assert.match(visibility, /subscribers\.size === 1/);
  assert.match(visibility, /document\.addEventListener\('visibilitychange'/);
  assert.match(visibility, /document\.removeEventListener\('visibilitychange'/);
  assert.match(animated, /data-page-visible=\{visible \? 'true' : 'false'\}/);
  assert.match(animatedCss, /data-page-visible='false'/);
});

test('only explicit icon SVGs get touch transforms; shared sheets use actual operation state', () => {
  assert.match(css, /svg\[data-knowme-icon\]/);
  assert.doesNotMatch(css, /svg:not\(\[data-no-touch-motion\]\)/);
  const sheet = fs.readFileSync(path.join(dir, 'post-share-sheet.tsx'), 'utf8');
  assert.match(sheet, /busyOperation === "feed"/);
  assert.match(sheet, /busyOperation === "story"/);
  assert.match(sheet, /busyOperation === "message"/);
  assert.match(sheet, /copied \? "success" : "idle"/);
  const shareStyle = fs.readFileSync(path.join(dir, 'post-share-sheet.css'), 'utf8');
  assert.match(shareStyle, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(shareStyle, /button svg \{[^}]*width:47px/);
  assert.match(shareStyle, /km-share-action-icon/);
  assert.match(sheet, /className="km-share-action-icon"/);
  const networkStyle = fs.readFileSync(path.join(dir, 'network-connectivity-notice.css'), 'utf8');
  assert.match(networkStyle, /width: 44px; height: 44px/);
  const avatar = fs.readFileSync(path.join(dir, 'avatar-quick-actions.tsx'), 'utf8');
  assert.match(avatar, /state=\{open \? "open" : "closed"\}/);
  assert.match(animatedCss, /data-icon-state='open'/);
  assert.match(animatedCss, /km-icon-heart-release/);
});

test('motion respects browser, KnowMe, and native system accessibility', () => {
  assert.match(css, /--km-glyph-touch-speed: 110ms/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(animatedCss, /data-animated-icons='false'/);
  assert.match(native, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(native, /name === 'settings'/);
  assert.match(native, /onPressIn=\{\(\) => to\(0\.93\)\}/);
});

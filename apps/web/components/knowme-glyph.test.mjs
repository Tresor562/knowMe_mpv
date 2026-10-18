import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const dir = import.meta.dirname;
const glyph = fs.readFileSync(path.join(dir, 'knowme-glyph.tsx'), 'utf8');
const navigation = fs.readFileSync(path.join(dir, 'bottom-navigation.tsx'), 'utf8');
const css = fs.readFileSync(path.join(dir, '..', 'app', 'iconography.css'), 'utf8');
const native = fs.readFileSync(path.join(dir, '..', '..', 'mobile', 'src', 'ui', 'KnowMeUI.tsx'), 'utf8');

test('every declared KnowMe SVG icon has its own drawable', () => {
  const declared = glyph.match(/export type KnowMeGlyphName =([\s\S]*?);/)?.[1] ?? '';
  const shapeSource = glyph.match(/const shapes: Record<KnowMeGlyphName, ReactNode> = \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  const names = [...declared.matchAll(/'([\w-]+)'/g)].map(m => m[1]);
  assert.ok(names.length >= 35);
  assert.equal(new Set(names).size, names.length);
  for (const name of names)
    assert.match(shapeSource, new RegExp(`(?:^|[,\\n]\\s*)(?:'${name}'|${name}):\\s*<`));
  assert.match(glyph, /viewBox: '0 0 24 24'/);
  assert.match(glyph, /'aria-hidden': true/);
});

test('primary navigation selects the same state and uses the vector family', () => {
  assert.match(navigation, /import \{ KnowMeGlyph \}/);
  assert.match(navigation, /active=\{item\.matches\.includes\(pathname\)\}/);
});

test('SVG touch behavior is quick and offers accessibility reduced motion', () => {
  assert.match(css, /--km-glyph-touch-speed: 110ms/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-animations='false'/);
  assert.match(native, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(native, /name === 'settings'/);
  assert.match(native, /onPressIn=\{\(\) => to\(0\.93\)\}/);
});

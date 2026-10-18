import assert from 'node:assert/strict';
import test from 'node:test';
import { accessibleGlassPalette, accessibleVisualStyle } from './appearance-accessibility.ts';

test('reduced transparency chooses a solid surface without changing accent or text', () => {
  const palette = { surface: '#121212', surfaceGlass: 'rgba(18,18,18,.7)', accent: '#4daaff', text: '#fff' };
  assert.deepEqual(accessibleGlassPalette(palette, true), {
    ...palette, surfaceGlass: '#121212'
  });
  assert.equal(accessibleGlassPalette(palette, false), palette);
});

test('reduced motion removes navigation animation but keeps layout dimensions', () => {
  const visual = { transitionDuration: 260, glassBoost: 8, controlRadius: 22 };
  assert.deepEqual(accessibleVisualStyle(visual, true, false), {
    transitionDuration: 0, glassBoost: 8, controlRadius: 22
  });
  assert.deepEqual(accessibleVisualStyle(visual, false, true), {
    transitionDuration: 260, glassBoost: 0, controlRadius: 22
  });
  assert.deepEqual(accessibleVisualStyle(visual, true, true), {
    transitionDuration: 0, glassBoost: 0, controlRadius: 22
  });
  assert.equal(accessibleVisualStyle(visual, false, false), visual);
});

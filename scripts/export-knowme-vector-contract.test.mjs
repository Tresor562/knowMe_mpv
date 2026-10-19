import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = execFileSync(process.execPath, ['scripts/export-knowme-vector-contract.mjs','--json'],
  { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const manifest = JSON.parse(output);
const glyphs = manifest.glyphs;

test('all 79 canonical Web glyphs export as real vector primitives for future native', () => {
  assert.equal(Object.keys(glyphs).length, 79);
  assert.deepEqual(manifest.viewBox, [0,0,24,24]);
  assert.equal(manifest.inherited.strokeWidth, 1.9);
  for (const [name, shape] of Object.entries(glyphs)) {
    assert.ok(shape.inactive.length > 0, name);
    assert.ok(shape.active.length > 0, name);
    for (const variant of [shape.inactive, shape.active]) {
      assert.ok(variant.every(node => ['path','circle','ellipse','rect','line','polyline','polygon','g'].includes(node.tag)), name);
      assert.ok(!JSON.stringify(variant).includes('data:image/'), name);
    }
  }
});
test('selection variants preserve native heart/bookmark shapes without fake fill', () => {
  for (const name of ['heart','bookmark','verified','star','home']) {
    assert.notDeepEqual(glyphs[name].inactive, glyphs[name].active, name);
  }
  assert.equal(glyphs.heart.inactive[0].attrs.fill, 'none');
  assert.equal(glyphs.heart.active[0].attrs.fill, 'currentColor');
  assert.equal(manifest.paintTokens['var(--bg)'], 'theme-background');
});
test('skip and fullscreen are geometric glyphs with no font or embedded raster', () => {
  for (const name of ['rewind-10','forward-10','fullscreen','fullscreen-exit']) {
    const nodes = glyphs[name].inactive;
    assert.ok(nodes.some(node => node.tag === 'path'), name);
    assert.ok(nodes.every(node => node.tag !== 'text' && node.tag !== 'image'));
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { KNOWME_GLYPH_MOTION_ROLE } from './knowme-glyph-motion-roles.ts';

const dir = import.meta.dirname;
const svg = fs.readFileSync(path.join(dir, 'knowme-glyph.tsx'), 'utf8');
const animated = fs.readFileSync(path.join(dir, 'knowme-animated-icon.tsx'), 'utf8');
const css = fs.readFileSync(path.join(dir, '..', 'app', 'knowme-icon-motion.css'), 'utf8');
const declaration = svg.match(/export type KnowMeGlyphName =([\s\S]*?);/)?.[1] || '';
const declared = [...declaration.matchAll(/'([\w-]+)'/g)].map(m => m[1]);

test('every source glyph has exactly one semantic animation role', () => {
  assert.equal(declared.length, 79);
  assert.equal(new Set(declared).size, declared.length);
  assert.deepEqual(Object.keys(KNOWME_GLYPH_MOTION_ROLE).sort(), [...declared].sort());
  const roleNames = new Set(Object.values(KNOWME_GLYPH_MOTION_ROLE));
  assert.deepEqual([...roleNames].sort(), [
    'navigation', 'communication', 'media', 'social',
    'transfer', 'security', 'reward', 'utility'
  ].sort());
});

test('semantic categories have event-driven fallback and refined glyph motion', () => {
  assert.match(animated, /data-motion-role=\{KNOWME_GLYPH_MOTION_ROLE\[visibleName\]\}/);
  for (const role of new Set(Object.values(KNOWME_GLYPH_MOTION_ROLE))) {
    assert.ok(css.includes("[data-motion-role='" + role + "'][data-icon-burst]"), role);
  }
  assert.match(css, /km-state-icon--heart\[data-icon-state='selected'\]/);
  assert.match(css, /data-icon-burst/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-page-visible='false'/);
});

test('destructive, affirmative, and social operations are semantically differentiated', () => {
  assert.equal(KNOWME_GLYPH_MOTION_ROLE.heart, 'social');
  assert.equal(KNOWME_GLYPH_MOTION_ROLE['call-end'], 'communication');
  assert.equal(KNOWME_GLYPH_MOTION_ROLE.trash, 'security');
  assert.equal(KNOWME_GLYPH_MOTION_ROLE.check, 'security');
  assert.equal(KNOWME_GLYPH_MOTION_ROLE.gift, 'reward');
  assert.equal(KNOWME_GLYPH_MOTION_ROLE['rewind-10'], 'media');
  assert.equal(KNOWME_GLYPH_MOTION_ROLE.download, 'transfer');
});

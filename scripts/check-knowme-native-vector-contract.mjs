#!/usr/bin/env node
/**
 * Deterministic shared SVG geometry for React Native.
 * Web JSX is the single source of truth for the 79 shared glyphs.
 *
 * node scripts/check-knowme-native-vector-contract.mjs
 * node scripts/check-knowme-native-vector-contract.mjs --write
 *
 * This checks vector data parity, not Android native renderer installation.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const contractFile = path.join(root, 'apps/mobile/src/ui/knowme-native-vector-contract.json');
const web = JSON.parse(execFileSync(process.execPath,
  [path.join(root, 'scripts/export-knowme-vector-contract.mjs'), '--json'],
  { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));

const shape = (tag, attrs) => ({ tag, attrs });
const extras = {
  challenge: {
    role: 'reward',
    inactive: [
      shape('path', { d: 'M4 4h16v6a8 8 0 0 1-16 0V4ZM4 7H2v3a5 5 0 0 0 5 5M20 7h2v3a5 5 0 0 1-5 5M12 18v3M8 22h8' }),
      shape('path', { d: 'm9.4 10.4 1.7 1.7 3.5-3.5' })
    ]
  },
  coins: {
    role: 'reward',
    inactive: [
      shape('circle', { cx: 12, cy: 12, r: 9 }),
      shape('path', { d: 'M15.8 8.8c-1.6-1.2-5.6-1.4-6.6.5-1.9 3.2 6.8 1.7 6.5 5.4-.2 2.2-4.8 3-7.7.7M12 5v14' })
    ]
  },
  arrow: {
    role: 'navigation',
    inactive: [shape('path', { d: 'm5 12 7-7 7 7M12 5v14' })]
  },
  'chevron-down': {
    role: 'navigation',
    inactive: [shape('path', { d: 'm5 9 7 7 7-7' })]
  },
  'chevron-up': {
    role: 'navigation',
    inactive: [shape('path', { d: 'm5 15 7-7 7 7' })]
  }
};
for (const glyph of Object.values(extras)) glyph.active = glyph.inactive;

const expected = {
  ...web,
  glyphs: { ...web.glyphs, ...extras }
};
const names = Object.keys(expected.glyphs);
assert.equal(Object.keys(web.glyphs).length, 79);
assert.equal(names.length, 84, 'Shared Web + native-only glyph count changed');
assert.equal(new Set(names).size, names.length);
assert.deepEqual(expected.viewBox, [0, 0, 24, 24]);
const allowedTags = new Set(['path','rect','circle','ellipse','line','polyline','polygon','g']);
const allowedPaint = new Set(['currentColor', 'var(--bg)', 'none']);
const allowedRoles = new Set(['navigation','communication','media','social',
  'transfer','security','reward','utility']);
for (const [name, glyph] of Object.entries(expected.glyphs)) {
  assert.match(name, /^[a-z0-9-]+$/);
  assert.ok(allowedRoles.has(glyph.role), 'Unknown animation role for '+name);
  for (const variant of ['inactive', 'active']) {
    assert.ok(glyph[variant].length, 'Empty SVG variant '+name+'/'+variant);
    for (const node of glyph[variant]) {
      assert.ok(allowedTags.has(node.tag), 'Unsupported native SVG tag '+node.tag);
      for (const [key, value] of Object.entries(node.attrs)) {
        assert.ok(!/(href|url|onload|script|foreignobject)/i.test(key),
          'Unsafe SVG attribute '+name+'/'+key);
        assert.ok(typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)));
        if (key === 'stroke' || key === 'fill')
          assert.ok(allowedPaint.has(value), 'Invalid paint token '+name+'/'+value);
      }
    }
  }
}
const content = JSON.stringify(expected, null, 2) + '\n';
if (process.argv.includes('--write')) {
  fs.writeFileSync(contractFile, content);
  console.log('Wrote native SVG geometry contract for '+names.length+' glyphs.');
} else {
  assert.equal(fs.readFileSync(contractFile, 'utf8'), content,
    'Native SVG contract differs from Web. Run node scripts/check-knowme-native-vector-contract.mjs --write');
  console.log('Native SVG geometry contract matches all '+names.length+' glyphs (79 Web + 5 native).');
}

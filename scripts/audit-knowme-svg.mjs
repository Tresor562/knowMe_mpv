#!/usr/bin/env node
/**
 * Exhaustive local inventory of static SVG files and inline JSX SVGs.
 * Usage: node scripts/audit-knowme-svg.mjs [--strict]
 * No network, external dependencies or rewriting of protected brand assets.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const strict = process.argv.includes('--strict');
const roots = ['apps/web', 'apps/mobile', 'packages'];
const ignored = new Set(['node_modules', '.next', '.expo', 'dist', 'build', 'coverage', '.git']);
const extensions = new Set(['.svg', '.tsx', '.jsx', '.ts', '.js']);
const findings = [];
let scanned = 0, icons = 0, separate = 0;

function inspect(file) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  const extension = path.extname(file);
  if (!extensions.has(extension)) return;
  const source = fs.readFileSync(file, 'utf8');
  scanned++;
  if (extension === '.svg') separate++;
  const regex = /<(svg|Svg)\b([^>]*?)>/gs;
  for (const match of source.matchAll(regex)) {
    const tag = match[0];
    const line = source.slice(0, match.index).split('\n').length;
    icons++;
    const comments = [];
    if (!/\bviewBox\s*=/.test(tag) && !tag.includes('{...'))
      comments.push('missing viewBox');
    if (!/\b(?:aria-hidden|aria-label|aria-labelledby|role)\s*=/.test(tag) &&
        !tag.includes('{...'))
      comments.push('missing accessible or decorative semantics');
    if (/\b(?:width|height)\s*=\s*["']?(?:0|[5-9][0-9]{2,})\b/.test(tag))
      comments.push('suspicious size (check illustration context)');
    if (comments.length) findings.push({ file: relative, line, comments });
  }
}
function visit(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.isFile()) inspect(target);
  }
}
for (const dir of roots) visit(path.join(root, dir));
console.log(JSON.stringify({ scanned, svgTags: icons, standaloneSVG: separate,
  warnings: findings.length, findings }, null, 2));
if (strict && findings.length) process.exitCode = 1;

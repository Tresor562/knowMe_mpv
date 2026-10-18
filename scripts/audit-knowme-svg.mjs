#!/usr/bin/env node
/**
 * KnowMe design inventory.
 * This is an inventory (not a claim that assets are corrected).
 *
 * node scripts/audit-knowme-svg.mjs            # compact grouped inventory
 * node scripts/audit-knowme-svg.mjs --json     # full file/line inventory
 * node scripts/audit-knowme-svg.mjs --strict   # reject malformed standalone SVGs
 *
 * Covers source-managed glyphs, inline and dynamically-created SVG, images
 * referenced by CSS, icon libraries, Android VectorDrawable XML, and native
 * icons built out of styled Views. Packages served at runtime by external
 * libraries cannot be fully audited from their call sites: explicit unknowns.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const roots = ['apps/web', 'apps/mobile', 'packages', 'scripts'];
const ignored = new Set(['node_modules', '.next', '.expo', 'dist', 'build', 'coverage',
  '.git', '.turbo', '.gradle', 'android-build', 'Pods']);
const sourceTypes = new Set(['.tsx', '.jsx', '.js', '.mjs', '.ts', '.css', '.html', '.cjs', '.json']);
const vectorTypes = new Set(['.svg', '.xml']);
const rasterTypes = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.ico']);

const fileRows = [];
const warnings = [];
const sum = {
  inspectedFiles: 0, svgFiles: 0, androidVectorFiles: 0, inlineSVG: 0,
  jsxSvgReferences: 0, dynamicSVG: 0, iconLibraryReferences: 0,
  nativeComposedIconReferences: 0, rasterAssetFiles: 0, cssSvgReferences: 0
};
function lineOf(source, index) { return source.slice(0, index).split('\n').length; }
function add(row, kind, source, regex) {
  for (const match of source.matchAll(regex)) row.findings.push({
    kind, line: lineOf(source, match.index), sample: match[0].slice(0, 160)
  });
}
function inspect(file) {
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  const extension = path.extname(file).toLowerCase();
  if (!sourceTypes.has(extension) && !vectorTypes.has(extension) && !rasterTypes.has(extension)) return;
  sum.inspectedFiles++;
  if (rasterTypes.has(extension)) { sum.rasterAssetFiles++; return; }
  const source = fs.readFileSync(file, 'utf8');
  const row = { file: rel, findings: [] };
  if (extension === '.svg') {
    sum.svgFiles++;
    const svgRoot = source.match(/<svg\b[^>]*>/is)?.[0] ?? '';
    if (!svgRoot || !/\bviewBox\s*=/.test(svgRoot)) {
      warnings.push({ file: rel, line: 1, issue: 'Standalone SVG missing root or viewBox' });
    }
    if (/<(?:script|foreignObject)\b|\bon\w+\s*=|javascript:/i.test(source)) {
      warnings.push({ file: rel, line: 1, issue: 'Unsafe or foreign SVG content requires manual review' });
    }
    row.findings.push({ kind: 'standalone-svg', line: 1 });
  }
  if (extension === '.xml' && /<vector\b/i.test(source)) {
    sum.androidVectorFiles++;
    row.findings.push({ kind: 'android-vector', line: 1 });
  }
  if (sourceTypes.has(extension)) {
    add(row, 'inline-svg', source, /<svg\b/gi);
    add(row, 'react-native-svg', source, /<Svg(?=[\s>])/g);
    add(row, 'dynamic-svg', source, /\b(?:createElementNS\s*\(\s*['"]https?:\/\/www\.w3\.org\/2000\/svg['"]|createElement\s*\(\s*['"]svg['"]|dangerouslySetInnerHTML|data:image\/svg\+xml)/g);
    add(row, 'svg-import', source, /(?:from\s*['"][^'"]+\.svg['"]|require\s*\(\s*['"][^'"]+\.svg['"]\))/g);
    add(row, 'icon-library', source, /(?:from\s*['"](?:lucide-react|react-icons[^'"]*|@expo\/vector-icons|@fortawesome\/[^'"]+|react-native-vector-icons[^'"]*|react-native-svg)['"]|<(?:FontAwesome|MaterialIcons|Ionicons|Feather)\b)/g);
    add(row, 'native-icon-composed', source, /\b(?:KnowMeIcon|NavIcon|ActionIcon|ShareGlyph|PressScale)\b/g);
    if (extension === '.css') add(row, 'css-svg-reference', source, /url\([^)]*(?:\.svg|svg\+xml)[^)]*\)/gi);
  }
  sum.inlineSVG += row.findings.filter(f => f.kind === 'inline-svg').length;
  sum.jsxSvgReferences += row.findings.filter(f => f.kind === 'react-native-svg').length;
  sum.dynamicSVG += row.findings.filter(f => f.kind === 'dynamic-svg').length;
  sum.iconLibraryReferences += row.findings.filter(f => f.kind === 'icon-library' || f.kind === 'svg-import').length;
  sum.nativeComposedIconReferences += row.findings.filter(f => f.kind === 'native-icon-composed').length;
  sum.cssSvgReferences += row.findings.filter(f => f.kind === 'css-svg-reference').length;
  if (row.findings.length) fileRows.push(row);
}
function visit(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(item.name) || item.isSymbolicLink()) continue;
    const target = path.join(dir, item.name);
    if (item.isDirectory()) visit(target);
    else if (item.isFile()) inspect(target);
  }
}
for (const dir of roots) visit(path.join(root, dir));
fileRows.sort((a, b) => a.file.localeCompare(b.file));
const result = {
  base: 'source tree at execution SHA', counts: sum, filesWithVectorsOrReferences: fileRows.length,
  warnings, externalDependenciesNotVetted: true,
  completeness: 'Static source inventory only: runtime remotely-loaded icons and 3rd-party package internals require runtime inspection'
};
if (process.argv.includes('--json')) console.log(JSON.stringify({ ...result, files: fileRows }, null, 2));
else console.log(JSON.stringify({ ...result,
  groups: fileRows.reduce((groups, r) => {
    const key = r.file.split('/').slice(0, 2).join('/');
    groups[key] = (groups[key] ?? 0) + 1;
    return groups;
  }, {})
}, null, 2));
if (process.argv.includes('--strict') && warnings.length) process.exitCode = 1;

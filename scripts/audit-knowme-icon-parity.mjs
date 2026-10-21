#!/usr/bin/env node
/** Audit *real* SVG geometry and native renderer readiness.
 * Mechanical prerequisites never replace physical device visual QA.
 * node scripts/audit-knowme-icon-parity.mjs [--json] [--require-parity]
 */
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const read = p => fs.readFileSync(path.join(root,p), 'utf8');
const web = read('apps/web/components/knowme-glyph.tsx');
const native = read('apps/mobile/src/ui/KnowMeUI.tsx');
const renderer = read('apps/mobile/src/ui/KnowMeNativeVectorIcon.tsx');
const vector = JSON.parse(read('apps/mobile/src/ui/knowme-native-vector-contract.json'));
const pkg = JSON.parse(read('apps/mobile/package.json'));
const lock = read('pnpm-lock.yaml');

function names(text, declaration) {
  const m = text.match(new RegExp('export type ' + declaration + ' =([\\s\\S]*?);'));
  if (!m) throw new Error('Missing glyph type '+declaration);
  return [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map(x => x[1]);
}
const webNames = names(web,'KnowMeGlyphName');
const nativeNames = names(native,'KnowMeIconName');
const aliases = {
  messages: 'chats', bell: 'notifications', spark: 'sparkles',
  'video-call': 'video', 'phone-call': 'phone',
  'more-vertical': 'more', paperclip: 'attach'
};
const geometry = vector.glyphs || {};
const hasValidPaths = name => {
  const item = geometry[name];
  return !!item && ['inactive','active'].every(variant =>
    Array.isArray(item[variant]) && item[variant].length > 0 &&
    item[variant].every(node => ['path','circle','ellipse','rect','line',
      'polyline','polygon','g'].includes(node.tag)));
};
const webWithoutNativeGeometry = webNames.filter(name => !hasValidPaths(name));
const nativeWithoutVectorGeometry = nativeNames.filter(name =>
  !hasValidPaths(aliases[name] ?? name));
const nativeSVGRendererDeclared = pkg.dependencies?.['react-native-svg'] === '15.11.2';
const nativeSVGRendererLocked =
  lock.includes('  react-native-svg@15.11.2:') &&
  lock.includes('      react-native-svg:') &&
  lock.includes('        specifier: 15.11.2');
const nativeRendersSvgPaths =
  renderer.includes("from 'react-native-svg'") &&
  renderer.includes('<Svg') &&
  renderer.includes('createElement(Element');
const wiredIntoExistingNativeScreens =
  native.includes('hasKnowMeNativeVectorGlyph(name)') &&
  native.includes('<KnowMeNativeVectorIcon');
const minimumVectorPrerequisites = nativeSVGRendererDeclared &&
  nativeSVGRendererLocked && nativeRendersSvgPaths &&
  wiredIntoExistingNativeScreens &&
  webWithoutNativeGeometry.length === 0 &&
  nativeWithoutVectorGeometry.length === 0;
const report = {
  webCount: webNames.length,
  nativeNameCount: nativeNames.length,
  nativeVectorContractCount: Object.keys(geometry).length,
  nativeSVGRendererDeclared,
  nativeSVGRendererLocked,
  nativeRendersSvgPaths,
  wiredIntoExistingNativeScreens,
  webWithoutNativeGeometry,
  nativeWithoutVectorGeometry,
  minimumVectorPrerequisites,
  status: minimumVectorPrerequisites
    ? 'CODE_PREREQUISITES_OK: physical device visual, interaction and accessibility QA still required'
    : 'INCOMPLETE: missing SVG geometry, renderer, lockfile or native screen wiring'
};
if (new Set(webNames).size !== webNames.length ||
    new Set(nativeNames).size !== nativeNames.length)
  throw Error('Duplicate named icons');
console.log(JSON.stringify(report,null,2));
if (process.argv.includes('--require-parity') && !minimumVectorPrerequisites) {
  console.error('Native vector parity prerequisites blocked. Resolve missing items above.');
  process.exitCode = 2;
}

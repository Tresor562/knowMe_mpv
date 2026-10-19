#!/usr/bin/env node
/** Track actual vector family parity across Web and native KnowMe.
 * This is an audit, NOT proof that a View-composed Android icon is true SVG.
 * node scripts/audit-knowme-icon-parity.mjs [--json]
 * node scripts/audit-knowme-icon-parity.mjs --require-parity  # fails until native SVG parity is actually proven
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const webPath = path.join(root, 'apps/web/components/knowme-glyph.tsx');
const nativePath = path.join(root, 'apps/mobile/src/ui/KnowMeUI.tsx');
const web = fs.readFileSync(webPath, 'utf8');
const native = fs.readFileSync(nativePath, 'utf8');

function names(text, declaration) {
  const r = new RegExp('export type ' + declaration + ' =([\\s\\S]*?);');
  const declarationText = text.match(r)?.[1];
  if (!declarationText) throw new Error('Missing ' + declaration);
  return [...declarationText.matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]);
}
const webNames = names(web, 'KnowMeGlyphName');
const nativeNames = names(native, 'KnowMeIconName');
const aliases = {
  notifications: 'bell',
  chats: 'messages',
  phone: 'phone-call',
  attach: 'paperclip',
  sparkles: 'spark',
  more: 'more-vertical',
  video: 'video-call'
};
const nativeSet = new Set(nativeNames);
const matched = webNames.filter(name => nativeSet.has(aliases[name] ?? name));
const webOnly = webNames.filter(name => !nativeSet.has(aliases[name] ?? name));
const nativeOnly = nativeNames.filter(name =>
  !webNames.includes(name) && !Object.values(aliases).includes(name));
const mobilePackage = fs.readFileSync(path.join(root, 'apps/mobile/package.json'), 'utf8');
const nativeSVGRendererDeclared = /['"]react-native-svg['"]/.test(mobilePackage);
const nativeRendersSvgPaths = /from\s*['"]react-native-svg['"]/.test(native) &&
  /<(?:Svg|Path)\b/.test(native);
// These are only minimum mechanical requirements. Even when they pass,
// genuine end-to-end shape, animation and accessibility parity needs QA.
const minimumVectorPrerequisites = nativeSVGRendererDeclared &&
  nativeRendersSvgPaths && webOnly.length === 0;
const report = {
  webCount: webNames.length,
  nativeNameCount: nativeNames.length,
  nativeSVGRendererDeclared,
  nativeRendersSvgPaths,
  minimumVectorPrerequisites,
  namesMappedToNativeViewOrVector: matched.length,
  webOnly,
  nativeOnly,
  status: minimumVectorPrerequisites
    ? 'PREREQUISITES_ONLY: device visual and UX parity still require review'
    : 'INCOMPLETE: native SVG renderer, glyph mapping or path coverage missing'
};
if (new Set(webNames).size !== webNames.length ||
    new Set(nativeNames).size !== nativeNames.length) throw new Error('Duplicate glyph name');
if (process.argv.includes('--json')) console.log(JSON.stringify(report,null,2));
else console.log(JSON.stringify({
  ...report,
  webOnly: webOnly.slice(0, 18),
  webOnlyRemaining: Math.max(0, webOnly.length - 18)
}, null, 2));

if (process.argv.includes('--require-parity') && !minimumVectorPrerequisites) {
  console.error('Native SVG parity release gate BLOCKED. Install renderer, implement true SVG paths and map every Web glyph, then verify on device.');
  process.exitCode = 2;
}

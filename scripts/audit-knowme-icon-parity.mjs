#!/usr/bin/env node
/** Track actual vector family parity across Web and native KnowMe.
 * This is an audit, NOT proof that a View-composed Android icon is true SVG.
 * node scripts/audit-knowme-icon-parity.mjs [--json]
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
const report = {
  webCount: webNames.length,
  nativeNameCount: nativeNames.length,
  nativeSVGRendererDeclared: /['"]react-native-svg['"]/.test(
    fs.readFileSync(path.join(root, 'apps/mobile/package.json'), 'utf8')
  ),
  namesMappedToNativeViewOrVector: matched.length,
  webOnly,
  nativeOnly,
  status: 'INCOMPLETE: native names composed with Views, not native SVG paths'
};
if (new Set(webNames).size !== webNames.length ||
    new Set(nativeNames).size !== nativeNames.length) throw new Error('Duplicate glyph name');
if (process.argv.includes('--json')) console.log(JSON.stringify(report,null,2));
else console.log(JSON.stringify({
  ...report,
  webOnly: webOnly.slice(0, 18),
  webOnlyRemaining: Math.max(0, webOnly.length - 18)
}, null, 2));

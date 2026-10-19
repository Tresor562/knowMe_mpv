#!/usr/bin/env node
/**
 * Portable KnowMe SVG geometry contract for future native rendering.
 * Parses the canonical Web JSX with TypeScript rather than brittle regexes.
 * Does not claim an Android SVG renderer has been installed.
 *
 * node scripts/export-knowme-vector-contract.mjs
 * node scripts/export-knowme-vector-contract.mjs --json
 *
 * The contract contains both unselected and selected variants. The native
 * renderer must still supply theme tokens and compatible react-native-svg.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePath = path.resolve(import.meta.dirname, '../apps/web/components/knowme-glyph.tsx');
const text = fs.readFileSync(sourcePath, 'utf8');
const rolesPath = path.resolve(import.meta.dirname, '../apps/web/components/knowme-glyph-motion-roles.ts');
const rolesSource = fs.readFileSync(rolesPath, 'utf8');
const roles = {};
for (const entry of rolesSource.matchAll(/^\s*(?:'([a-z0-9-]+)'|([a-z0-9-]+)):\s*'(navigation|communication|media|social|transfer|security|reward|utility)',?\s*$/gm)) {
  const name = entry[1] || entry[2];
  if (roles[name]) throw Error('Duplicate semantic vector role '+name);
  roles[name] = entry[3];
}

// The canonical Web JSX ends with `satisfies Record<KnowMeGlyphName,...>`,
// which yields a TS SatisfiesExpression around the object-literal initializer.
// Preserve the static compile-time contract and unwrap only the type check.
const ast = ts.createSourceFile(sourcePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
if (ast.parseDiagnostics.length) throw Error('Cannot parse canonical icon JSX: ' +
  ast.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; '));
const declaration = text.match(/export type KnowMeGlyphName =([\s\S]*?);/)?.[1] ?? '';
const names = [...declaration.matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]);
if (!names.length || names.length !== new Set(names).size) throw Error('Invalid/duplicate Web glyph declarations');

let shapes;
function find(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'shapes') {
    let initializer = node.initializer;
    while (initializer && (ts.isSatisfiesExpression(initializer) ||
      ts.isAsExpression(initializer) || ts.isParenthesizedExpression(initializer)))
      initializer = initializer.expression;
    if (!initializer || !ts.isObjectLiteralExpression(initializer))
      throw Error('Canonical icon shapes must be a static object literal');
    shapes = initializer;
  }
  ts.forEachChild(node, find);
}
find(ast);
if (!shapes) throw Error('Missing canonical shapes JSX object');

function plainValue(expr, selected) {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr))
    return expr.text;
  if (ts.isNumericLiteral(expr)) return Number(expr.text);
  if (ts.isConditionalExpression(expr) && ts.isIdentifier(expr.condition) &&
      expr.condition.text === 'active')
    return plainValue(selected ? expr.whenTrue : expr.whenFalse, selected);
  throw Error('Unsupported dynamic SVG attribute: ' + expr.getText(ast).slice(0, 120));
}
function attributes(element, selected) {
  const attrs = {};
  for (const prop of element.properties) {
    if (!ts.isJsxAttribute(prop)) throw Error('SVG spread attributes cannot be exported safely');
    const name = prop.name.getText(ast);
    if (!prop.initializer) { attrs[name] = true; continue; }
    if (ts.isStringLiteral(prop.initializer)) attrs[name] = prop.initializer.text;
    else if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression)
      attrs[name] = plainValue(prop.initializer.expression, selected);
    else throw Error('Unsupported JSX attribute initializer for ' + name);
  }
  return attrs;
}
function walk(node, selected) {
  if (ts.isJsxFragment(node)) return node.children.flatMap(c => walk(c, selected));
  if (ts.isJsxSelfClosingElement(node))
    return [{ tag: node.tagName.getText(ast), attrs: attributes(node.attributes, selected) }];
  if (ts.isJsxElement(node))
    return [{ tag: node.openingElement.tagName.getText(ast),
      attrs: attributes(node.openingElement.attributes, selected),
      children: node.children.flatMap(c => walk(c, selected)) }];
  if (ts.isJsxExpression(node) && node.expression) {
    const e = node.expression;
    if (ts.isBinaryExpression(e) &&
        e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        ts.isIdentifier(e.left) && e.left.text === 'active')
      return selected ? walk(e.right, selected) : [];
    throw Error('Unsupported dynamic SVG child: ' + e.getText(ast).slice(0, 120));
  }
  if (ts.isJsxText(node) && !node.text.trim()) return [];
  throw Error('Unexpected SVG node: ' + node.getText(ast).slice(0, 120));
}

const glyphs = {};
const allowed = new Set(['path','circle','ellipse','rect','line','polyline','polygon','g']);
for (const prop of shapes.properties) {
  if (!ts.isPropertyAssignment(prop)) throw Error('Unsupported SVG shape property');
  const name = prop.name.getText(ast).replace(/^['"]|['"]$/g, '');
  if (glyphs[name]) throw Error('Duplicate shape ' + name);
  const inactive = walk(prop.initializer, false);
  const active = walk(prop.initializer, true);
  const valid = nodes => nodes.every(node => allowed.has(node.tag) &&
    (node.children ? valid(node.children) : true));
  if (!inactive.length || !valid(inactive) || !valid(active))
    throw Error('Glyph '+name+' has missing or unsupported SVG geometry');
  if (!roles[name]) throw Error('No semantic motion role for vector '+name);
  glyphs[name] = { role: roles[name], inactive, active };
}
if (Object.keys(roles).length !== names.length)
  throw Error('Motion roles and vector family differ');
const missing = names.filter(name => !glyphs[name]);
const extra = Object.keys(glyphs).filter(name => !names.includes(name));
if (missing.length || extra.length) throw Error('Vector contract mismatch: '+JSON.stringify({missing,extra}));
const result = {
  schemaVersion: 1,
  source: 'apps/web/components/knowme-glyph.tsx',
  viewBox: [0, 0, 24, 24],
  inherited: { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9,
    strokeLinecap: 'round', strokeLinejoin: 'round' },
  paintTokens: { 'currentColor': 'theme-icon-ink', 'var(--bg)': 'theme-background' },
  glyphs
};
if (process.argv.includes('--json')) console.log(JSON.stringify(result,null,2));
else console.log(JSON.stringify({ totalGlyphs: Object.keys(glyphs).length,
  viewBox: result.viewBox, trueVectorGeometry: true,
  hasSelectedVariants: true, nativeRendererRequired: true }, null, 2));

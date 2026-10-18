import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const dir = import.meta.dirname;
const glyph = fs.readFileSync(path.join(dir, 'knowme-glyph.tsx'), 'utf8');
const navigation = fs.readFileSync(path.join(dir, 'bottom-navigation.tsx'), 'utf8');
const animated = fs.readFileSync(path.join(dir, 'knowme-animated-icon.tsx'), 'utf8');
const animatedCss = fs.readFileSync(path.join(dir, '..', 'app', 'knowme-icon-motion.css'), 'utf8');
const css = fs.readFileSync(path.join(dir, '..', 'app', 'iconography.css'), 'utf8');
const native = fs.readFileSync(path.join(dir, '..', '..', 'mobile', 'src', 'ui', 'KnowMeUI.tsx'), 'utf8');

test('each declared SVG glyph has a drawable shape', () => {
  const declared = glyph.match(/export type KnowMeGlyphName =([\s\S]*?);/)?.[1] ?? '';
  const shapes = glyph.match(/const shapes = \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  const names = [...declared.matchAll(/'([\w-]+)'/g)].map(m => m[1]);
  assert.ok(names.length >= 75);
  for (const essential of [
    'copy','reply','pin','archive','folder','file','group','user-plus',
    'shield','verified','gift','clock','calendar','volume','volume-off',
    'headphones','music','stop','call-end','more-horizontal','info',
    'warning','help','logout','star','filter','sort','map-pin',
    'translate','check-circle'
  ]) assert.ok(names.includes(essential), essential);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) {
    const rx = new RegExp(`(?:^|[,\\n]\\s*)(?:'${name}'|${name}):\\s*<`);
    assert.match(shapes, rx, `missing glyph ${name}`);
  }
  assert.match(glyph, /viewBox: '0 0 24 24'/);
  assert.match(glyph, /'aria-hidden': true/);
});

test('navigation and actual connectivity consume the canonical animated glyph', () => {
  assert.match(navigation, /KnowMeAnimatedIcon/);
  assert.match(navigation, /active=\{item\.matches\.includes\(pathname\)\}/);
  const connectivity = fs.readFileSync(path.join(dir, 'network-connectivity-notice.tsx'), 'utf8');
  assert.match(connectivity, /eventToken=\{state\}/);
  assert.match(connectivity, /name=\{offline \? 'wifi-off' : 'wifi'\}/);
});

test('motion derives from data, differentiates icon roles and stops safely', () => {
  assert.match(animated, /didIconEventChange\(earlier, next\)/);
  assert.match(animated, /clampRealProgress\(state, progress\)/);
  assert.match(animated, /presentationGlyphName\(name, state\)/);
  assert.match(animated, /mayAnimateIndefinitely\(state\)/);
  assert.match(animatedCss, /km-icon-bell-ring/);
  assert.match(animatedCss, /km-icon-flight/);
  assert.match(animatedCss, /km-icon-heart-pop/);
  assert.match(animatedCss, /km-icon-stack/);
  assert.match(animatedCss, /km-icon-gift-pop/);
  assert.match(animatedCss, /km-icon-confirm-focus/);
  assert.match(animatedCss, /#ef3340/);
  assert.match(animatedCss, /prefers-reduced-motion: reduce/);
  const visibility = fs.readFileSync(path.join(dir, 'knowme-document-visibility.ts'), 'utf8');
  assert.match(visibility, /subscribers\.size === 1/);
  assert.match(visibility, /document\.addEventListener\('visibilitychange'/);
  assert.match(visibility, /document\.removeEventListener\('visibilitychange'/);
  assert.match(animated, /data-page-visible=\{visible \? 'true' : 'false'\}/);
  assert.match(animatedCss, /data-page-visible='false'/);
});

test('only explicit icon SVGs get touch transforms; shared sheets use actual operation state', () => {
  assert.match(css, /svg\[data-knowme-icon\]/);
  assert.doesNotMatch(css, /svg:not\(\[data-no-touch-motion\]\)/);
  const sheet = fs.readFileSync(path.join(dir, 'post-share-sheet.tsx'), 'utf8');
  assert.match(sheet, /busyOperation === "feed"/);
  assert.match(sheet, /busyOperation === "story"/);
  assert.match(sheet, /busyOperation === "message"/);
  assert.match(sheet, /copied \? "success" : "idle"/);
  const shareStyle = fs.readFileSync(path.join(dir, 'post-share-sheet.css'), 'utf8');
  assert.match(shareStyle, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(shareStyle, /button svg \{[^}]*width:47px/);
  assert.match(shareStyle, /km-share-action-icon/);
  assert.match(sheet, /className="km-share-action-icon"/);
  const networkStyle = fs.readFileSync(path.join(dir, 'network-connectivity-notice.css'), 'utf8');
  assert.match(networkStyle, /width: 44px; height: 44px/);
  const avatar = fs.readFileSync(path.join(dir, 'avatar-quick-actions.tsx'), 'utf8');
  assert.match(avatar, /state=\{open \? "open" : "closed"\}/);
  assert.match(animated, /presentationGlyphName\(name, state\)/);
  assert.doesNotMatch(animatedCss, /\.km-state-icon--create\[data-icon-state='open'\]/);
  assert.match(animatedCss, /km-icon-heart-release/);
});

test('motion respects browser, KnowMe, and native system accessibility', () => {
  assert.match(css, /--km-glyph-touch-speed: 110ms/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(animatedCss, /data-animated-icons='false'/);
  assert.match(native, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(native, /name === 'settings'/);
  assert.match(native, /onPressIn=\{\(\) => to\(0\.93\)\}/);
});


test('icon action controls are accessible and preserve long-press semantics', () => {
  const action = fs.readFileSync(path.join(dir, 'knowme-icon-button.tsx'), 'utf8');
  const style = fs.readFileSync(path.join(dir, 'knowme-icon-button.css'), 'utf8');
  const network = fs.readFileSync(path.join(dir, 'network-connectivity-notice.tsx'), 'utf8');
  const sheet = fs.readFileSync(path.join(dir, 'post-share-sheet.tsx'), 'utf8');
  const layout = fs.readFileSync(path.join(dir, '..', 'app', 'layout.tsx'), 'utf8');
  assert.ok(action.includes('aria-label={accessibleLabel}'));
  assert.ok(action.includes('Number.isFinite(progress)'));
  assert.ok(action.includes('Math.round(confirmedProgress * 100)'));
  assert.ok(action.includes('title={onLongPress ? undefined : label}'));
  assert.ok(action.includes("type=\"button\""));
  assert.ok(action.includes('aria-pressed={toggle ? state ==='));
  assert.ok(action.includes('aria-busy={busy || undefined}'));
  assert.ok(action.includes('onPointerDown={startLongPress}'));
  assert.ok(action.includes('onPointerMove={movePointer}'));
  assert.ok(action.includes('onPointerCancel={endPointer}'));
  assert.ok(action.includes('onContextMenu={event =>'));
  assert.ok(action.includes('event.detail !== 0'));
  assert.ok(action.includes('onLongPress();'));
  assert.ok(animated.includes("settings.animatedIcons === 'false'"));
  assert.ok(animated.includes("settings.effectiveReducedMotion === 'true'"));
  assert.ok(animatedCss.includes("km-state-icon--chats[data-icon-state='loading']"));
  assert.ok(animatedCss.includes("km-state-icon--home[data-icon-state='sending']"));
  assert.ok(style.includes('min-width: 44px;'));
  assert.ok(style.includes('min-height: 44px;'));
  assert.ok(style.includes(':focus-visible'));
  assert.ok(network.includes('<KnowMeIconButton name="close"'));
  assert.ok(sheet.includes('<KnowMeIconButton name="close"'));
  assert.ok(layout.includes("knowme-icon-button.css"));
  assert.ok(css.includes("min-width: 44px;"));
  assert.ok(css.includes(".km-avatar-plus::before"));
  assert.ok(css.includes("inset: 5px;"));
  assert.ok(css.includes(".km-avatar-plus:focus-visible"));
});


test('profile avatar menu is viewport-anchored, keyboard-accessible, and returns focus', () => {
  const avatar = fs.readFileSync(path.join(dir, 'avatar-quick-actions.tsx'), 'utf8');
  const style = fs.readFileSync(path.join(dir, '..', 'app', 'iconography.css'), 'utf8');
  assert.match(avatar, /createPortal\(<div ref=\{menuRef\}/);
  assert.match(avatar, /document\.body\)\}/);
  assert.match(avatar, /menuRef\.current\?\.offsetHeight \?\? 290/);
  assert.match(avatar, /event\.key === 'ArrowDown'/);
  assert.match(avatar, /event\.key === 'ArrowUp'/);
  assert.match(avatar, /event\.key === 'Home'/);
  assert.match(avatar, /event\.key === 'End'/);
  assert.match(avatar, /querySelector<HTMLElement>\('\[role="menuitem"\]:not\(\[disabled\]\)'\)/);
  assert.match(avatar, /onBlur=\{event =>/);
  assert.match(avatar, /previewClose\.current\?\.focus\(\)/);
  assert.match(avatar, /event\.key === 'Tab'/);
  assert.match(avatar, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(avatar, /trigger\.current\?\.focus\(\)/);
  assert.match(avatar, /className="km-avatar-lightbox"/);
  assert.match(avatar, /const menuId = useId\(\)/);
  assert.match(avatar, /aria-controls=\{open \? menuId : undefined\}/);
  assert.match(avatar, /<div id=\{menuId\} ref=\{menuRef\}/);
  assert.match(avatar, /event\.target === event\.currentTarget\) setPreview\(false\)/);
  assert.match(style, /\.km-avatar-menu \{\s*position: fixed;/);
  assert.match(style, /\.km-avatar-lightbox \{\s*position: fixed;/);
  assert.match(style, /overscroll-behavior: contain/);
});


test('share modal retains focus and cannot dismiss while a write is pending', () => {
  const share = fs.readFileSync(path.join(dir, 'post-share-sheet.tsx'), 'utf8');
  assert.match(share, /const dialogRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(share, /const closeRef = useRef\(onClose\)/);
  assert.match(share, /closeRef\.current = onClose/);
  assert.match(share, /dialogRef\.current\?\.querySelector<HTMLElement>/);
  assert.match(share, /if \(!submitting\.current\)/);
  assert.match(share, /event\.key !== 'Tab'/);
  assert.match(share, /event\.shiftKey/);
  assert.match(share, /dialogRef\.current\?\.contains\(active\)/);
  assert.match(share, /previousFocus\.current\?\.focus\(\)/);
  assert.match(share, /<section ref=\{dialogRef\} className="km-share-sheet" role="dialog" aria-modal="true"/);
});

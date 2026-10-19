import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = import.meta.dirname;
const glyph = fs.readFileSync(path.join(dir, 'knowme-glyph.tsx'), 'utf8');
const navigation = fs.readFileSync(path.join(dir, 'bottom-navigation.tsx'), 'utf8');
const animated = fs.readFileSync(path.join(dir, 'knowme-animated-icon.tsx'), 'utf8');
const animatedCss = fs.readFileSync(path.join(dir, '..', 'app', 'knowme-icon-motion.css'), 'utf8');
const css = fs.readFileSync(path.join(dir, '..', 'app', 'iconography.css'), 'utf8');
const native = fs.readFileSync(path.join(dir, '..', '..', 'mobile', 'src', 'ui', 'KnowMeUI.tsx'), 'utf8');

test('each declared SVG glyph has a drawable shape', () => {
  const declared = glyph.match(/export type KnowMeGlyphName =([\s\S]*?);/)?.[1] ?? '';
  const shapes = glyph.match(/const shapes = \{([\s\S]*?)\n  \} satisfies Record<KnowMeGlyphName, unknown>;/)?.[1] ?? '';
  const names = [...declared.matchAll(/'([\w-]+)'/g)].map(m => m[1]);
  assert.ok(names.length >= 79);
  for (const essential of [
    'copy','reply','pin','archive','folder','file','group','user-plus',
    'shield','verified','gift','clock','calendar','volume','volume-off',
    'headphones','music','stop','call-end','more-horizontal','info',
    'warning','help','logout','star','filter','sort','map-pin',
    'rewind-10','forward-10','fullscreen','fullscreen-exit',
    'translate','check-circle'
  ]) assert.ok(names.includes(essential), essential);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) {
    const rx = new RegExp(`(?:^|[,\\n]\\s*)(?:'${name}'|${name}):\\s*<`);
    assert.match(shapes, rx, `missing glyph ${name}`);
  }
  assert.match(glyph, /satisfies Record<KnowMeGlyphName, unknown>/);
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
  const viewport = fs.readFileSync(path.join(dir, 'knowme-icon-viewport.ts'), 'utf8');
  assert.match(viewport, /let sharedObserver: IntersectionObserver \| null/);
  assert.match(viewport, /rootMargin: '64px 0px'/);
  assert.match(viewport, /observer\.observe\(node\)/);
  assert.match(viewport, /observer\.unobserve\(node\)/);
  assert.match(viewport, /observer\.disconnect\(\)/);
  assert.match(animated, /useKnowMeIconViewportVisible\(watching\)/);
  assert.match(animated, /previous\.current\.state !== 'idle'/);
  assert.match(animated, /eventToken !== null \|\| burst/);
  assert.match(animated, /const watching = state !== 'idle'/);
  assert.match(animated, /const visible = documentVisible && inViewport/);

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
  assert.match(avatar, /createPortal\(<div id=\{menuId\} ref=\{menuRef\}/);
  assert.match(avatar, /document\.body\) as unknown as CompatiblePortalChild\)\}/);
  assert.match(avatar, /menuRef\.current\?\.offsetHeight \?\? 290/);
  assert.match(avatar, /nextAvatarMenuIndex\(/);
  assert.match(avatar, /AvatarMenuNavigationKey/);
  assert.match(avatar, /'ArrowDown', 'ArrowUp', 'Home', 'End'/);
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


test('post video toolbar uses truthful state-driven SVGs and 44px controls', () => {
  const video = fs.readFileSync(path.join(dir, 'post-video-player.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(dir, 'post-video-player.css'), 'utf8');
  for (const glyph of ['rewind-10','forward-10','fullscreen','fullscreen-exit','volume','volume-off']) {
    assert.ok(glyph.includes('-') ? video.includes(glyph) : video.includes("'" + glyph + "'"), glyph);
  }
  assert.match(video, /<KnowMeAnimatedIcon name="play" state=\{playing \? 'playing' : 'paused'\}/);
  assert.match(video, /aria-pressed=\{playing\}/);
  assert.match(video, /aria-pressed=\{muted\}/);
  assert.match(video, /aria-pressed=\{fullscreen\}/);
  assert.match(video, /if \(event\.detail === 0\)/);
  assert.match(video, /setSeekEvents\(previous =>/);
  assert.match(video, /eventToken=\{seekEvents\.back\}/);
  assert.match(video, /eventToken=\{seekEvents\.forward\}/);
  assert.match(animatedCss, /km-state-icon--rewind-10\[data-icon-burst\]/);
  assert.match(animatedCss, /km-state-icon--fullscreen\[data-icon-burst\]/);
  assert.doesNotMatch(video, /🔇|🔊|↶10|10↷|⛶|Ⅱ|▶/);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /min-height: 44px/);
});


test('shared notifications and reporting use real accessible iconography', () => {
  const alerts = fs.readFileSync(path.join(dir, 'knowme-feedback.tsx'), 'utf8');
  const report = fs.readFileSync(path.join(dir, 'comment-report-sheet.tsx'), 'utf8');
  const style = fs.readFileSync(path.join(dir, 'comment-report-sheet.css'), 'utf8');
  assert.match(alerts, /<KnowMeGlyph name="shield"/);
  assert.match(alerts, /toast\.tone === 'error'/);
  assert.match(alerts, /'warning' : toast\.tone === 'success' \? 'check-circle' : 'info'/);
  assert.match(alerts, /<KnowMeIconButton name="close"/);
  assert.match(report, /<KnowMeIconButton name="close"/);
  assert.match(report, /<KnowMeAnimatedIcon name="send" state=\{busy \? 'sending' : 'idle'\}/);
  assert.doesNotMatch(report, /Fermer le signalement">×/);
  assert.match(style, /min-width: 44px/);
});


test('post editor and member picker use accessible compact vector affordances', () => {
  const edit = fs.readFileSync(path.join(dir, 'post-edit-sheet.tsx'), 'utf8');
  const editCss = fs.readFileSync(path.join(dir, 'post-options-sheet.css'), 'utf8');
  const members = fs.readFileSync(path.join(dir, 'profile-member-picker.tsx'), 'utf8');
  const membersCss = fs.readFileSync(path.join(dir, 'profile-member-picker.css'), 'utf8');
  assert.match(edit, /<KnowMeIconButton name="close"/);
  assert.match(edit, /<KnowMeAnimatedIcon name=\{busy \? 'refresh' : 'check'\}/);
  assert.match(editCss, /km-post-edit-sheet header \.km-icon-action/);
  assert.match(members, /aria-label=\{\`Retirer \$\{member\.displayName\} de la sélection\`\}/);
  assert.match(members, /<KnowMeGlyph name="close" size=\{16\}/);
  assert.match(members, /<KnowMeGlyph name=\{selected \? 'check' : unavailable \? 'lock' : 'user-plus'\}/);
  assert.match(members, /<KnowMeAnimatedIcon name="search" size=\{17\} state="loading"/);
  assert.doesNotMatch(members, /member\.username\} ×/);
  assert.match(membersCss, /min-height: 44px/);
  assert.match(membersCss, /min-height: 56px/);
  assert.match(membersCss, /:focus-visible/);
});


test('creator actions, media categories and private profile CTA use compact stateful vectors', () => {
  const creator = fs.readFileSync(path.join(dir, 'creator-follow-control.tsx'), 'utf8');
  const creatorCss = fs.readFileSync(path.join(dir, 'creator-follow-control.css'), 'utf8');
  const media = fs.readFileSync(path.join(dir, 'media-download-settings.tsx'), 'utf8');
  const mediaCss = fs.readFileSync(path.join(dir, 'media-download-vector.css'), 'utf8');
  const secret = fs.readFileSync(path.join(dir, 'secret-profile-entry.tsx'), 'utf8');
  const secretCss = fs.readFileSync(path.join(dir, 'secret-profile-entry.css'), 'utf8');
  assert.match(creator, /<KnowMeAnimatedIcon name="refresh" state=\{busy \|\| loading \? 'loading' : 'idle'\}/);
  assert.match(creator, /action === 'unfollow' \? 'check' : 'user-plus'/);
  assert.match(creator, /aria-pressed=\{action === 'unfollow'\}/);
  assert.match(creator, /aria-busy=\{busy\}/);
  assert.match(creatorCss, /min-height: 44px/);
  assert.match(media, /const MEDIA_GLYPHS: Record<MediaKind, KnowMeGlyphName>/);
  assert.match(media, /const NETWORK_GLYPHS:/);
  assert.match(media, /<KnowMeAnimatedIcon name=\{busy \? 'refresh' : 'trash'\}/);
  assert.match(media, /<KnowMeGlyph name=\{MEDIA_GLYPHS\[kind\]\}/);
  assert.match(mediaCss, /min-height: 44px/);
  assert.match(secret, /<KnowMeGlyph name="shield" size=\{23\}/);
  assert.match(secret, /<KnowMeGlyph name="send" size=\{18\}/);
  assert.doesNotMatch(secret, /🕵️|className="card"/);
  assert.match(secretCss, /min-height: 44px/);
});


test('all vector glyphs have real-event motion fallback, idle never loops', () => {
  const motion = fs.readFileSync(path.join(dir, '..', 'app', 'knowme-icon-motion.css'), 'utf8');
  const model = fs.readFileSync(path.join(dir, 'knowme-animated-icon.tsx'), 'utf8');
  assert.match(motion, /\.km-state-icon\[data-icon-burst\] > svg:first-child \{[\s\S]*?animation-name: km-icon-focus/);
  assert.match(motion, /:where\(\.km-state-icon\[data-auto-motion='true'\]\[data-icon-state='loading'\]\)/);
  assert.match(motion, /:where\(\.km-state-icon\[data-auto-motion='true'\]\[data-icon-state='syncing'\]\)/);
  assert.match(motion, /km-state-icon--refresh\[data-icon-state='loading'\]/);
  assert.match(motion, /km-state-icon--microphone\[data-icon-state='recording'\]/);
  assert.match(model, /data-auto-motion=\{motionEnabled && visible && mayAnimateIndefinitely\(state\)/);
  assert.match(model, /settings\.animatedIcons === 'false'/);
});


test('rewind and forward 10 are font-independent SVG numerals', () => {
  const glyph = fs.readFileSync(path.join(dir, 'knowme-glyph.tsx'), 'utf8');
  assert.doesNotMatch(glyph, /<text\b|fontSize="7\.8"/);
  assert.match(glyph, /<ellipse cx="14\.25" cy="13" rx="1\.45" ry="2\.85"/);
  assert.match(glyph, /<path d="m9\.7 11 1\.1-1v6"/);
});


test('official KnowMe brand remains the canonical asset, without unsafe SVG content', () => {
  const logo = fs.readFileSync(path.join(dir, '..', 'public', 'brand', 'knowme-logo.svg'), 'utf8');
  const css = fs.readFileSync(path.join(dir, '..', 'app', 'iconography.css'), 'utf8');
  // The approved brand is a 256px PNG embedded in an SVG wrapper.
  // Replacing it with an unrelated vector both changes identity and breaks
  // Android's release icon/splash generator.
  assert.match(logo, /viewBox="0 0 256 256"/);
  assert.match(logo, /<image\b[^>]*href="data:image\/png;base64,/);
  assert.match(logo, /aria-label="KnowMe"/);
  assert.doesNotMatch(logo, /<script\b|<foreignObject\b|javascript:/i);
  assert.match(css, /\.km-brand:hover \.km-brand-logo/);
  assert.match(css, /\.km-brand:active \.km-brand-logo/);
  assert.match(css, /:root\[data-animated-icons='false'\] \.km-brand-logo/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});


test('three original collectible gifts are vector, state-controlled, motion-safe and accessible', () => {
  const gift = fs.readFileSync(path.join(dir, 'knowme-gift-artwork.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(dir, 'knowme-gift-artwork.css'), 'utf8');
  for (const variant of ['aurora', 'cosmos', 'blossom']) {
    assert.ok(gift.includes(variant), variant);
  }
  assert.match(gift, /type KnowMeGiftState = 'idle' \| 'opening' \| 'opened' \| 'claimed'/);
  assert.match(gift, /state = 'idle'/);
  assert.match(gift, /eventToken = null/);
  assert.match(gift, /before\.state !== state/);
  assert.match(gift, /state === 'idle'\) return/);
  assert.match(gift, /data-state=\{state\}/);
  assert.match(gift, /data-burst=\{motionEnabled && burst \? 'true' : 'false'\}/);
  assert.match(gift, /aria-label=\{\(label \|\| fallback\) \+ status\}/);
  assert.match(gift, /<svg key=\{eventToken \?\? state\} viewBox="0 0 128 128"/);
  assert.match(gift, /useKnowMeIconViewportVisible\(/);
  assert.match(gift, /preferences\.effectiveReducedMotion === 'true'/);
  assert.match(gift, /linearGradient/);
  assert.match(gift, /radialGradient/);
  assert.match(gift, /km-collectible-lid/);
  assert.match(gift, /km-collectible-bow/);
  assert.match(gift, /km-collectible-crown/);
  assert.match(gift, /variant === 'aurora'/);
  assert.match(gift, /variant === 'cosmos'/);
  assert.match(gift, /variant === 'blossom'/);
  assert.match(gift, /km-collectible-magic/);
  assert.doesNotMatch(gift, /<image\b|data:image|\.png|foreignObject|<text\b/);
  assert.match(css, /km-gift-lid-peek/);
  assert.match(css, /km-gift-lid-open/);
  assert.match(css, /km-gift-claimed/);
  assert.match(css, /km-gift-crown/);
  assert.match(css, /data-burst='true'\]\[data-visible='true'\]/);
  assert.match(css, /data-state='opening'/);
  assert.match(css, /data-state='opened'/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-visible='false'/);
});


test('interactive QA lab is noindex, exposes exhaustive glyphs and never calls production APIs', () => {
  const root = path.join(dir, '..', 'app', 'design', 'iconography');
  const route = fs.readFileSync(path.join(root, 'page.tsx'), 'utf8');
  const lab = fs.readFileSync(path.join(dir, 'knowme-icon-laboratory.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(dir, 'knowme-icon-laboratory.css'), 'utf8');
  assert.match(route, /robots: \{ index: false, follow: false \}/);
  assert.match(lab, /Object\.keys\(KNOWME_GLYPH_MOTION_ROLE\) as KnowMeGlyphName\[\]/);
  assert.match(lab, /visible\.map\(name =>/);
  assert.match(lab, /<KnowMeAnimatedIcon name=\{active\}/);
  assert.match(lab, /<KnowMeGiftArtwork variant=\{variant\}/);
  assert.match(lab, /VARIANTS: KnowMeGiftVariant\[\] = \['aurora', 'cosmos', 'blossom'\]/);
  assert.match(lab, /const GIFT_STATES: KnowMeGiftState\[\]/);
  assert.doesNotMatch(lab, /apiFetch\(|fetch\(|window\.location\s*=|navigator\.sendBeacon/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /max-width: 390px/);
});


test('shared vector buttons give tactile feedback without faking persisted state', () => {
  const css = fs.readFileSync(path.join(dir, 'knowme-icon-button.css'), 'utf8');
  assert.match(css, /\.km-icon-action:active:not\(:disabled\) > \.km-state-icon/);
  assert.match(css, /scale\(\.89\)/);
  assert.match(css, /\.km-icon-action\[aria-pressed='true'\]:not\(:active\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-effective-reduced-motion='true'/);
});


test('brand QA vector is genuine geometry and cannot silently replace official identity', () => {
  const fsPath = path.join(dir, '..', 'public', 'brand');
  const original = fs.readFileSync(path.join(fsPath, 'knowme-logo.svg'), 'utf8');
  const vector = fs.readFileSync(path.join(fsPath, 'knowme-logo-vector-prototype.svg'), 'utf8');
  const lab = fs.readFileSync(path.join(dir, 'knowme-icon-laboratory.tsx'), 'utf8');
  const official = fs.readFileSync(path.join(dir, 'knowme-brand.tsx'), 'utf8');
  assert.match(original, /data:image\/png;base64,/);
  assert.doesNotMatch(vector, /data:image\/|<image\b|<script\b|<foreignObject\b|javascript:/i);
  assert.match(vector, /viewBox="0 0 256 256"/);
  assert.match(vector, /<path\b/);
  assert.match(vector, /<radialGradient\b/);
  assert.match(vector, /<linearGradient\b/);
  assert.ok(vector.length < original.length / 8, 'vector prototype should be much smaller than bitmap wrapper');
  assert.match(lab, /img src="\/brand\/knowme-logo-vector-prototype\.svg"/);
  assert.match(lab, /Le prototype ne remplace pas le logo officiel/);
  assert.match(official, /src="\/brand\/knowme-logo\.svg"/);
  assert.doesNotMatch(official, /knowme-logo-vector-prototype/);
});


test('three gift designs have distinct engraved vector emblems and event-only gleam', () => {
  const gift = fs.readFileSync(path.join(dir, 'knowme-gift-artwork.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(dir, 'knowme-gift-artwork.css'), 'utf8');
  for (const motif of ['aurora', 'cosmos', 'blossom']) {
    assert.match(gift, new RegExp('km-collectible-emblem-' + motif));
  }
  assert.match(gift, /variant === 'aurora' && <g className="km-collectible-emblem-aurora">/);
  assert.match(gift, /variant === 'cosmos' && <g className="km-collectible-emblem-cosmos">/);
  assert.match(gift, /variant === 'blossom' && <g className="km-collectible-emblem-blossom">/);
  assert.match(gift, /<ellipse cx="83" cy="88.5" rx="9.5" ry="12"/);
  assert.match(css, /data-burst='true'\]\[data-visible='true'\]\[data-state='claimed'\] \.km-collectible-emblem/);
  assert.match(css, /@keyframes km-gift-emblem-gleam/);
  assert.doesNotMatch(gift, /<image\b|<foreignObject\b|data:image|<text\b/);
});


test('brand vector prototype contains no embedded raster; legacy logo is explicitly disclosed', () => {
  const web = path.join(dir, '..');
  const official = fs.readFileSync(path.join(web, 'public', 'brand', 'knowme-logo.svg'), 'utf8');
  const prototype = fs.readFileSync(path.join(web, 'public', 'brand', 'knowme-logo-vector-prototype.svg'), 'utf8');
  const audit = fs.readFileSync(path.join(web, '..', '..', 'scripts', 'audit-knowme-svg.mjs'), 'utf8');
  const lab = fs.readFileSync(path.join(dir, 'knowme-icon-laboratory.tsx'), 'utf8');
  assert.match(official, /<image\b[^>]+href="data:image\/png;base64,/);
  assert.match(prototype, /<path\b/);
  assert.match(prototype, /<linearGradient\b/);
  assert.match(prototype, /<radialGradient\b/);
  assert.doesNotMatch(prototype, /<image\b|data:image\/|<script\b|<foreignObject\b/);
  assert.match(audit, /rasterInsideSvgFiles/);
  assert.match(audit, /embedded-raster-in-svg/);
  assert.match(lab, /id="km-brand-logo-compare"/);
  assert.match(lab, /data-testid="logo-vector-reveal"/);
  assert.match(lab, /logoReveal/);
});


test('native icon parity reports all shared geometry and validates real SVG prerequisites', () => {
  const script = path.join(dir, '..', '..', '..', 'scripts', 'audit-knowme-icon-parity.mjs');
  const diagnostic = spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8' });
  assert.equal(diagnostic.status, 0, diagnostic.stderr);
  const report = JSON.parse(diagnostic.stdout);
  assert.equal(report.webCount, 79);
  assert.equal(report.nativeVectorContractCount, 84);
  assert.deepEqual(report.webWithoutNativeGeometry, []);
  assert.deepEqual(report.nativeWithoutVectorGeometry, []);
  const strict = spawnSync(process.execPath, [script, '--require-parity', '--json'], { encoding: 'utf8' });
  assert.equal(strict.status, report.minimumVectorPrerequisites ? 0 : 2, strict.stderr);
  if (!report.minimumVectorPrerequisites) {
    assert.match(strict.stderr, /Native vector parity prerequisites blocked/);
  } else {
    assert.equal(report.nativeSVGRendererLocked, true);
    assert.equal(report.nativeRendersSvgPaths, true);
    assert.equal(report.wiredIntoExistingNativeScreens, true);
  }
});


test('post options sheets have vector actions and modal keyboard focus safety', () => {
  const menu = fs.readFileSync(path.join(dir, 'post-options-sheet.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(dir, 'post-options-sheet.css'), 'utf8');
  for (const icon of ['share','link','file','profile','edit','trash','eye-off']) {
    assert.ok(menu.includes('name="' + icon + '"'), 'missing action ' + icon);
  }
  assert.match(menu, /<KnowMeIconButton name="close" size=\{20\}/);
  assert.doesNotMatch(menu, /aria-hidden="true">[↗⛓▤◯✎×−○]/);
  assert.match(menu, /const reasonIcons: KnowMeGlyphName\[\]/);
  assert.match(menu, /function usePostSheetFocus/);
  assert.match(menu, /previouslyFocused\?\.focus\(\)/);
  assert.match(menu, /event\.key !== 'Tab'/);
  assert.match(menu, /window\.requestAnimationFrame/);
  assert.match(menu, /document\.body\.style\.overflow = 'hidden'/);
  assert.equal((menu.match(/const sheetRef = usePostSheetFocus\(onClose\)/g) ?? []).length, 2);
  assert.match(css, /\.km-post-options-sheet header \.km-icon-action/);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /:focus-visible/);
});


test('notifications use event and category SVGs with real unread/critical state', () => {
  const source = fs.readFileSync(path.join(dir, '..', 'app', 'notifications', 'page.tsx'), 'utf8');
  const style = fs.readFileSync(path.join(dir, '..', 'app', 'notifications', 'notification-vectors.css'), 'utf8');
  assert.match(source, /Record<string, KnowMeGlyphName>/);
  assert.match(source, /icon: KnowMeGlyphName/);
  assert.match(source, /<KnowMeGlyph name=\{category\.icon\} size=\{18\}/);
  assert.match(source, /<KnowMeGlyph name=\{ICONS\[notification\.type\]/);
  assert.match(source, /active=\{group\.unreadCount > 0\}/);
  assert.match(source, /<KnowMeAnimatedIcon name="refresh" state="loading"/);
  for (const icon of ['forward','check-double','clock','archive','eye-off','refresh']) {
    assert.match(source, new RegExp('<KnowMeGlyph name="' + icon + '" size=\\{17\\}/>'));
  }
  assert.doesNotMatch(source, /[👥💬🎯🎁🕵⭐🛡⚙🤝🗞🔔]/u);
  assert.match(style, /min-height: 44px/);
  assert.match(style, /\.km-notification-type-icon/);
  assert.match(style, /:focus-visible/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_DOCK_SCROLL, nextDockScroll, shouldShowDock, navigationDockLayout } from './navigation-dock-model.ts';

function walk(points: number[]) {
  return points.reduce(nextDockScroll, INITIAL_DOCK_SCROLL);
}

test('dock stays in place for small scroll and disappears after downward travel', () => {
  assert.equal(walk([5,10,20]).visible,true);
  assert.equal(walk([30,55,81]).visible,false);
});
test('scrolling up restores dock and top of content always shows it', () => {
  const hidden=walk([30,55,81]);
  const restored=nextDockScroll(hidden,47);
  assert.equal(restored.visible,true);
  assert.equal(nextDockScroll(hidden,0).visible,true);
});
test('large jumps and invalid scroll events do not hide navigation', () => {
  assert.equal(nextDockScroll(INITIAL_DOCK_SCROLL, 450).visible,true);
  assert.deepEqual(nextDockScroll(INITIAL_DOCK_SCROLL, Number.NaN),INITIAL_DOCK_SCROLL);
});
test('immersive screens hide dock even with autohide disabled', () => {
  const base={screen:'home',keyboardVisible:false,createOpen:false,profileSubscreenActive:false,postDetailOpen:false,socialImmersive:false,scrollVisible:true,autoHide:true};
  assert.equal(shouldShowDock(base),true);
  assert.equal(shouldShowDock({...base,screen:'linked-sticker'}),false);
  assert.equal(shouldShowDock({...base,screen:'marketplace'}),false);
  assert.equal(shouldShowDock({...base,screen:'reels'}),false);
  assert.equal(shouldShowDock({...base,keyboardVisible:true}),false);
  assert.equal(shouldShowDock({...base,postDetailOpen:true}),false);
  assert.equal(shouldShowDock({...base,socialImmersive:true}),false);
  assert.equal(shouldShowDock({...base,createOpen:true}),false);
  assert.equal(shouldShowDock({...base,screen:'profile',profileSubscreenActive:true}),false);
  assert.equal(shouldShowDock({...base,scrollVisible:false,autoHide:false}),true);
});

test('six tabs retain equal tappable space on 320-430dp Android screens', () => {
  for (const position of ['bottom', 'top'] as const) {
    for (const width of [320, 340, 360, 380, 400, 430]) {
      const layout = navigationDockLayout(width, position);
      assert.ok(layout.cellWidth >= 44,
        `${position} dock at ${width}dp must not squeeze below 44dp (got ${layout.cellWidth})`);
      assert.ok(layout.minHeight >= 66);
      assert.equal(layout.sideInset === 0, position === 'top');
    }
  }
});

test('small Android dock uses short labels and a wider floating surface', () => {
  const narrow = navigationDockLayout(320, 'bottom');
  const wide = navigationDockLayout(430, 'bottom');
  assert.equal(narrow.narrow, true);
  assert.equal(narrow.sideInset, 4);
  assert.equal(narrow.captionFontSize, 9);
  assert.equal(wide.narrow, false);
  assert.equal(wide.sideInset, 10);
  assert.equal(wide.captionFontSize, 10);
});

test('invalid viewport safely chooses smallest supported six-column geometry', () => {
  assert.equal(navigationDockLayout(Number.NaN, 'bottom').cellWidth,
    navigationDockLayout(320, 'bottom').cellWidth);
});

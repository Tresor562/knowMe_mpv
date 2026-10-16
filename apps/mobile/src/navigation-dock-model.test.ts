import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_DOCK_SCROLL, nextDockScroll, shouldShowDock } from './navigation-dock-model.ts';

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
  assert.equal(shouldShowDock({...base,keyboardVisible:true}),false);
  assert.equal(shouldShowDock({...base,postDetailOpen:true}),false);
  assert.equal(shouldShowDock({...base,socialImmersive:true}),false);
  assert.equal(shouldShowDock({...base,createOpen:true}),false);
  assert.equal(shouldShowDock({...base,screen:'profile',profileSubscreenActive:true}),false);
  assert.equal(shouldShowDock({...base,scrollVisible:false,autoHide:false}),true);
});

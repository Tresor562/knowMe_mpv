import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_DOCK_SCROLL, isDockVisible, nextDockScroll } from './navigation-dock-model.ts';

test('dock remains visible on a short page or slight incidental scroll', () => {
  const a = nextDockScroll(INITIAL_DOCK_SCROLL, 6);
  const b = nextDockScroll(a, 24);
  assert.equal(b.visible, true);
});
test('dock hides on sustained downward travel and returns on upward travel', () => {
  const a = nextDockScroll(INITIAL_DOCK_SCROLL, 20);
  const b = nextDockScroll(a, 60);
  assert.equal(b.visible, false);
  const c = nextDockScroll(b, 48);
  assert.equal(c.visible, false);
  const d = nextDockScroll(c, 30);
  assert.equal(d.visible, true);
});
test('top of feed restores navigation and invalid measurements do not flip it', () => {
  const hidden = nextDockScroll(nextDockScroll(INITIAL_DOCK_SCROLL, 20), 80);
  assert.equal(nextDockScroll(hidden, NaN), hidden);
  assert.equal(nextDockScroll(hidden, 0).visible, true);
});
test('keyboard, overlay, detail, and secondary screens hide navigation', () => {
  const normal = { rootScreen:true, keyboardOpen:false, overlayOpen:false, detailOpen:false, showOnScroll:true };
  assert.equal(isDockVisible(normal), true);
  for (const key of ['rootScreen','keyboardOpen','overlayOpen','detailOpen','showOnScroll'] as const) {
    const modified = { ...normal, [key]: key === 'rootScreen' || key === 'showOnScroll' ? false : true };
    assert.equal(isDockVisible(modified), false, key);
  }
});

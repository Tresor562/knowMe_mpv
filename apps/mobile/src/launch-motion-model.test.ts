import assert from 'node:assert/strict';
import test from 'node:test';
import { KNOWME_LAUNCH_MOTION, resolveLaunchMotion } from './launch-motion-model.ts';

test('KnowMe start animation stays light and below the two-second budget', () => {
  const motion = resolveLaunchMotion(false);
  assert.deepEqual(motion, KNOWME_LAUNCH_MOTION);
  assert.ok(motion.enterMs > 0 && motion.exitMs > 0);
  assert.ok(motion.enterMs + motion.nameDelayMs + motion.exitMs < 2000);
});

test('reduced motion removes every decorative startup delay', () => {
  assert.deepEqual(resolveLaunchMotion(true), {
    enterMs: 0,
    nameDelayMs: 0,
    exitMs: 0
  });
});

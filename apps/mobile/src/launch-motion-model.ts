/**
 * Motion budget for KnowMe's in-app launch hand-off.
 * The startup illustration never holds the real application for a minimum duration.
 */
export const KNOWME_LAUNCH_MOTION = Object.freeze({
  enterMs: 260,
  nameDelayMs: 90,
  exitMs: 220
});

export function resolveLaunchMotion(reducedMotion: boolean) {
  return {
    enterMs: reducedMotion ? 0 : KNOWME_LAUNCH_MOTION.enterMs,
    nameDelayMs: reducedMotion ? 0 : KNOWME_LAUNCH_MOTION.nameDelayMs,
    exitMs: reducedMotion ? 0 : KNOWME_LAUNCH_MOTION.exitMs
  };
}

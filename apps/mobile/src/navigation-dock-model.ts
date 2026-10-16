/** Shared scroll behavior for KnowMe's six-action navigation dock.
 * The screen decides whether to render it; this model only tracks scrolling. */
export type DockScrollState = { lastOffset: number; travel: number; visible: boolean };
export type DockPosition = 'top' | 'bottom';

export const INITIAL_DOCK_SCROLL: DockScrollState = {
  lastOffset: 0, travel: 0, visible: true
};

export function nextDockScroll(state: DockScrollState, value: number): DockScrollState {
  if (!Number.isFinite(value)) return state;
  const offset = Math.max(0, value);
  if (offset <= 24) return { lastOffset: offset, travel: 0, visible: true };
  const delta = offset - state.lastOffset;
  if (Math.abs(delta) > 220) return { ...state, lastOffset: offset, travel: 0 };
  // Reverse direction resets distance instead of oscillating at the threshold.
  const travel = delta > 0 ? Math.max(0, state.travel) + delta
    : delta < 0 ? Math.min(0, state.travel) + delta : state.travel;
  if (travel >= 44) return { lastOffset: offset, travel: 0, visible: false };
  if (travel <= -26) return { lastOffset: offset, travel: 0, visible: true };
  return { ...state, lastOffset: offset, travel };
}

export type DockContext = {
  screen: string;
  keyboardVisible: boolean;
  createOpen: boolean;
  profileSubscreenActive: boolean;
  postDetailOpen: boolean;
  scrollVisible: boolean;
  autoHide: boolean;
};

export function shouldShowDock(context: DockContext) {
  if (context.keyboardVisible || context.createOpen || context.postDetailOpen) return false;
  if (context.screen === 'profile' && context.profileSubscreenActive) return false;
  if (['challenges', 'verification', 'linked-sticker', 'linked-channel',
    'linked-gift', 'linked-profile'].includes(context.screen)) return false;
  return !context.autoHide || context.scrollVisible;
}

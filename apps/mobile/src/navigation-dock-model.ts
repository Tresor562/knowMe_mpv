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
  socialImmersive: boolean;
  scrollVisible: boolean;
  autoHide: boolean;
};

export function shouldShowDock(context: DockContext) {
  if (context.keyboardVisible || context.createOpen || context.postDetailOpen || context.socialImmersive) return false;
  if (context.screen === 'profile' && context.profileSubscreenActive) return false;
  if (['challenges', 'marketplace', 'verification', 'linked-sticker', 'linked-channel',
    'linked-gift', 'linked-profile'].includes(context.screen)) return false;
  return !context.autoHide || context.scrollVisible;
}


/** Measure the six slots from the real Android logical viewport, not from
 * intrinsic text widths. The narrow dock keeps six independent 44dp+ targets. */
export function navigationDockLayout(viewportWidth: number, position: DockPosition) {
  const width = Number.isFinite(viewportWidth) ? Math.max(320, viewportWidth) : 320;
  const compact = width < 400;
  const narrow = width < 360;
  const sideInset = position === 'top' ? 0 : compact ? 4 : 10;
  // A top dock sits inside screen-header gutters (~14dp each side).
  const surfaceWidth = width - sideInset * 2 - (position === 'top' ? 28 : 0);
  const horizontalPadding = compact ? 3 : 4;
  return {
    compact,
    narrow,
    sideInset,
    horizontalPadding,
    cellWidth: (surfaceWidth - 2 * horizontalPadding) / 6,
    iconSize: narrow ? 21 : 23,
    captionFontSize: narrow ? 9 : 10,
    minHeight: position === 'top' ? 66 : 74
  };
}

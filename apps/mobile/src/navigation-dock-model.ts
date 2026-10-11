export type DockPlacement = 'top' | 'bottom';

export type DockScrollState = {
  offset: number;
  directionTravel: number;
  visible: boolean;
};

export const INITIAL_DOCK_SCROLL: DockScrollState = {
  offset: 0,
  directionTravel: 0,
  visible: true
};

/**
 * Natural, direction-based dock behavior. Short accidental finger movements
 * should not make navigation flash. When the list reaches the top, restore it.
 */
export function nextDockScroll(state: DockScrollState, offset: number): DockScrollState {
  if (!Number.isFinite(offset)) return state;
  const current = Math.max(0, offset);
  if (current < 18) {
    return { offset: current, directionTravel: 0, visible: true };
  }
  const movement = Math.max(-90, Math.min(90, current - state.offset));
  if (movement === 0) return { ...state, offset: current };
  const directionTravel = movement > 0
    ? Math.max(0, state.directionTravel) + movement
    : Math.min(0, state.directionTravel) + movement;

  return {
    offset: current,
    directionTravel,
    visible: directionTravel > 34 ? false : directionTravel < -22 ? true : state.visible
  };
}

export function isDockVisible(args: {
  rootScreen: boolean;
  keyboardOpen: boolean;
  overlayOpen: boolean;
  detailOpen: boolean;
  showOnScroll: boolean;
}): boolean {
  return args.rootScreen && !args.keyboardOpen && !args.overlayOpen
    && !args.detailOpen && args.showOnScroll;
}

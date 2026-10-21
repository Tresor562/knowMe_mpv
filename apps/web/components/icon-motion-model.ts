/**
 * Shared, pure presentation contract. A component MUST consume authoritative
 * operation state; the icon must never claim a server success on tap alone.
 */
export type IconOperationState =
  | 'idle' | 'selected' | 'unselected' | 'open' | 'closed'
  | 'loading' | 'progress' | 'success' | 'error'
  | 'sending' | 'recording' | 'playing' | 'paused'
  | 'incoming' | 'offline' | 'typing' | 'syncing' | 'call-active' | 'live';

export type IconSnapshot = {
  name: string;
  state: IconOperationState;
  eventToken?: string | number | null;
};

export function presentationGlyphName(name: string, state: IconOperationState): string {
  // Source of truth is playback status, not the previous button glyph.
  if ((name === 'play' || name === 'pause') && state === 'playing') return 'pause';
  if ((name === 'play' || name === 'pause') && state === 'paused') return 'play';
  if (name === 'download' && state === 'success') return 'check';
  if (name === 'copy' && state === 'success') return 'check';
  // The close state must stay recognizable with animations disabled.
  if (name === 'create' && state === 'open') return 'close';
  return name;
}

export function clampRealProgress(state: IconOperationState, progress?: number | null): number | null {
  if (state !== 'progress' || typeof progress !== 'number' || !Number.isFinite(progress))
    return null;
  return Math.max(0, Math.min(1, progress));
}

export function didIconEventChange(previous: IconSnapshot, current: IconSnapshot): boolean {
  return previous.name !== current.name
    || previous.state !== current.state
    || (current.eventToken != null && previous.eventToken !== current.eventToken);
}

export function mayAnimateIndefinitely(state: IconOperationState): boolean {
  return state === 'loading' || state === 'recording' || state === 'playing' ||
    state === 'typing' || state === 'syncing' || state === 'call-active' || state === 'live';
}

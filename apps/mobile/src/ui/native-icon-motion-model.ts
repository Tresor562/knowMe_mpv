/** State model shared by the native icon animator and its regression tests.
 * Never infer completed media transfers, accepted reactions or sent messages
 * from press gestures alone; these states come from the feature owner.
 */
export type NativeIconOperationState =
  | 'idle' | 'selected' | 'unselected' | 'open' | 'closed'
  | 'loading' | 'progress' | 'success' | 'error'
  | 'sending' | 'recording' | 'playing' | 'paused'
  | 'incoming' | 'offline' | 'typing' | 'syncing' | 'call-active' | 'live';

export type NativeIconSnapshot = {
  name: string;
  state: NativeIconOperationState;
  eventToken?: string | number | null;
};

export function nativeVisibleGlyph(name: string, state: NativeIconOperationState) {
  if ((name === 'play' || name === 'pause') && state === 'playing') return 'pause';
  if ((name === 'play' || name === 'pause') && state === 'paused') return 'play';
  if (name === 'download' && state === 'success') return 'check';
  return name;
}

export function nativeIconShouldLoop(state: NativeIconOperationState) {
  return ['loading', 'recording', 'playing', 'typing', 'syncing', 'call-active', 'live']
    .includes(state);
}

export function nativeIconChanged(previous: NativeIconSnapshot, next: NativeIconSnapshot) {
  return previous.name !== next.name || previous.state !== next.state
    || (next.eventToken != null && previous.eventToken !== next.eventToken);
}

export function nativeIconProgress(state: NativeIconOperationState, value: number | null | undefined) {
  if (state !== 'progress' || typeof value !== 'number' || !Number.isFinite(value))
    return null;
  return Math.max(0, Math.min(1, value));
}

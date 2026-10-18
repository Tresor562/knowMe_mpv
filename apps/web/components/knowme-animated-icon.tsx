'use client';

import { useEffect, useRef, useState } from 'react';
import { KnowMeGlyph, type KnowMeGlyphName } from './knowme-glyph';

/**
 * Motion tracks authoritative product state. No control is toggled by this
 * component: the consumer must persist the action, then update its props.
 *
 * - state is NOT a visual guess from touch
 * - eventToken increments only when a real event occurs (e.g. new notification)
 * - progress is genuine 0..1 progress; never simulate a completed transfer
 * - idle icons remain stationary
 */
export type KnowMeIconState =
  | 'idle' | 'selected' | 'unselected' | 'open' | 'closed'
  | 'loading' | 'progress' | 'success' | 'error'
  | 'sending' | 'recording' | 'playing' | 'paused'
  | 'incoming' | 'offline';

type Props = {
  name: KnowMeGlyphName;
  state?: KnowMeIconState;
  size?: number;
  progress?: number | null;
  eventToken?: string | number | null;
  className?: string;
};

/** Zero pending timers and no invisible animations for motion-sensitive users. */
export function KnowMeAnimatedIcon({
  name, state = 'idle', size = 22, progress = null,
  eventToken = null, className = ''
}: Props) {
  const previous = useRef({ name, state, eventToken });
  const [burst, setBurst] = useState(false);
  const [motionId, setMotionId] = useState(0);

  useEffect(() => {
    const earlier = previous.current;
    const changed = earlier.state !== state
      || earlier.name !== name
      || (eventToken != null && earlier.eventToken !== eventToken);
    previous.current = { name, state, eventToken };
    if (!changed) return;
    // An actual event can restart an animation even when state doesn't change.
    setBurst(true);
    setMotionId(v => v + 1);
    const timeout = window.setTimeout(() => setBurst(false), 380);
    return () => window.clearTimeout(timeout);
  }, [name, state, eventToken]);

  const numericProgress = typeof progress === 'number' && Number.isFinite(progress)
    ? Math.max(0, Math.min(1, progress))
    : null;
  const selected = state === 'selected';
  const spin = state === 'loading';
  const ring = state === 'progress' && numericProgress !== null;
  // Disable conflicting optimistic fill when the server did not confirm state.
  const showSelected = selected;
  const classes = ['km-state-icon', `km-state-icon--${name}`, className]
    .filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      data-knowme-motion={name}
      data-icon-state={state}
      data-icon-burst={burst ? String(motionId) : undefined}
      data-auto-motion={spin || state === 'recording' || state === 'playing' ? 'true' : 'false'}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <KnowMeGlyph name={name} size={size} active={showSelected || state === 'success'} />
      {ring && (
        <svg viewBox="0 0 24 24" width={size} height={size}
          className="km-state-icon-progress" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" opacity=".17"
            strokeWidth="1.8" />
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 10}
            strokeDashoffset={2 * Math.PI * 10 * (1 - numericProgress)}
            transform="rotate(-90 12 12)" />
        </svg>
      )}
    </span>
  );
}

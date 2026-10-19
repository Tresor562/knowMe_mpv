'use client';

import { useEffect, useRef, useState } from 'react';
import { KnowMeGlyph, type KnowMeGlyphName } from './knowme-glyph';
import { KNOWME_GLYPH_MOTION_ROLE } from './knowme-glyph-motion-roles';
import { useKnowMeDocumentVisible } from './knowme-document-visibility';
import { useKnowMeIconViewportVisible } from './knowme-icon-viewport';
import {
  clampRealProgress, didIconEventChange, mayAnimateIndefinitely,
  presentationGlyphName, type IconOperationState
} from './icon-motion-model';

/**
 * Motion tracks authoritative product state. No control is toggled by this
 * component: the consumer must persist the action, then update its props.
 *
 * - state is NOT a visual guess from touch
 * - eventToken increments only when a real event occurs (e.g. new notification)
 * - progress is genuine 0..1 progress; never simulate a completed transfer
 * - idle icons remain stationary
 */
export type KnowMeIconState = IconOperationState;
type Props = {
  name: KnowMeGlyphName;
  state?: KnowMeIconState;
  size?: number;
  progress?: number | null;
  eventToken?: string | number | null;
  className?: string;
  /** Optional QA/host override. Never changes account preferences. */
  motionEnabled?: boolean;
};

/** Zero pending timers and no invisible animations for motion-sensitive users. */
export function KnowMeAnimatedIcon({
  name, state = 'idle', size = 22, progress = null,
  eventToken = null, className = '', motionEnabled = true
}: Props) {
  const documentVisible = useKnowMeDocumentVisible();
  const watching = mayAnimateIndefinitely(state) || state === 'sending' ||
    state === 'incoming' || state === 'success' || state === 'selected';
  const { ref: iconRef, visible: inViewport } = useKnowMeIconViewportVisible(watching);
  const visible = documentVisible && inViewport;
  const previous = useRef({ name, state, eventToken });
  const [burst, setBurst] = useState(false);
  const [motionId, setMotionId] = useState(0);

  useEffect(() => {
    const earlier = previous.current;
    const next = { name, state, eventToken };
    const changed = didIconEventChange(earlier, next);
    previous.current = next;
    if (!visible || !motionEnabled) { setBurst(false); return; }
    if (!changed) return;
    // Animation settings are a user choice, not a reason to schedule hidden
    // timers for hundreds of idle icons on every server event.
    const settings = document.documentElement.dataset;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        settings.animations === 'false' ||
        settings.animatedIcons === 'false' ||
        settings.effectiveReducedMotion === 'true') {
      setBurst(false);
      return;
    }
    // An actual event can restart an animation even when state doesn't change.
    setBurst(true);
    setMotionId(v => v + 1);
    const timeout = window.setTimeout(() => setBurst(false), 380);
    return () => window.clearTimeout(timeout);
  }, [name, state, eventToken, visible, motionEnabled]);

  const numericProgress = clampRealProgress(state, progress);
  const visibleName = presentationGlyphName(name, state) as KnowMeGlyphName;
  const selected = state === 'selected';
  const ring = numericProgress !== null;
  // Disable conflicting optimistic fill when the server did not confirm state.
  const showSelected = selected;
  const classes = ['km-state-icon', `km-state-icon--${visibleName}`, className]
    .filter(Boolean).join(' ');

  return (
    <span
      ref={iconRef}
      className={classes}
      data-knowme-motion={visibleName}
      data-motion-role={KNOWME_GLYPH_MOTION_ROLE[visibleName]}
      data-icon-state={state}
      data-icon-burst={motionEnabled && burst ? String(motionId) : undefined}
      data-auto-motion={motionEnabled && visible && mayAnimateIndefinitely(state) ? 'true' : 'false'}
      data-page-visible={visible ? 'true' : 'false'}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <KnowMeGlyph key={motionId} name={visibleName} size={size} active={showSelected || state === 'success'} />
      {state === 'typing' && (
        <svg viewBox="0 0 24 24" width={size} height={size}
          className="km-state-icon-typing" aria-hidden="true" focusable="false">
          <circle cx="7" cy="14.5" r="1.2" />
          <circle cx="12" cy="14.5" r="1.2" />
          <circle cx="17" cy="14.5" r="1.2" />
        </svg>
      )}
      {state === 'live' && (
        <span className="km-state-icon-live-dot" aria-hidden="true" />
      )}
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

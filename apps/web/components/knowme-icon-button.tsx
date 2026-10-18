'use client';

import { useEffect, useRef, type PointerEvent, type MouseEvent } from 'react';
import { KnowMeAnimatedIcon, type KnowMeIconState } from './knowme-animated-icon';
import { type KnowMeGlyphName } from './knowme-glyph';

type IconActionProps = {
  name: KnowMeGlyphName;
  label: string;
  onClick: () => void;
  state?: KnowMeIconState;
  size?: number;
  disabled?: boolean;
  className?: string;
  /** Only toggle controls expose aria-pressed. Server-confirmed state wins. */
  toggle?: boolean;
  onLongPress?: () => void;
  progress?: number | null;
  eventToken?: string | number | null;
};

/**
 * Shared compact Web icon control. A 20–24px glyph has a >=44px hit area.
 * The icon is decorative; the real button carries the accessible action.
 * For long-press actions the caller must open a real picker/menu.
 */
export function KnowMeIconButton({
  name, label, onClick, state = 'idle', size = 22, disabled = false,
  className = '', toggle = false, onLongPress, progress, eventToken
}: IconActionProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const pointerActive = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => { clearTimer(); }, []);

  function startLongPress(event: PointerEvent<HTMLButtonElement>) {
    clearTimer();
    longPressed.current = false;
    pointerActive.current = true;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    // Right click enters through onContextMenu, not this touch gesture.
    if (disabled || !onLongPress || event.button !== 0) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!pointerActive.current) return;
      longPressed.current = true;
      onLongPress();
    }, 480);
  }
  function movePointer(event: PointerEvent<HTMLButtonElement>) {
    const start = pointerStart.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
      clearTimer();
      pointerActive.current = false;
    }
  }
  function endPointer() {
    pointerActive.current = false;
    pointerStart.current = null;
    clearTimer();
  }
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (longPressed.current) {
      longPressed.current = false;
      // A long touch may synthesize a click; a later keyboard activation
      // (detail=0) is independent and must not be swallowed.
      if (event.detail !== 0) {
        event.preventDefault();
        return;
      }
    }
    if (!disabled) onClick();
  }

  const busy = ['loading', 'sending', 'syncing', 'progress'].includes(state);
  return (
    <button type="button"
      className={['km-icon-action', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      aria-pressed={toggle ? state === 'selected' : undefined}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={handleClick}
      onPointerDown={startLongPress}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={endPointer}
      onContextMenu={event => {
        if (!onLongPress || disabled) return;
        event.preventDefault();
        if (!longPressed.current) {
          longPressed.current = true;
          onLongPress();
        }
      }}
    >
      <KnowMeAnimatedIcon name={name} state={state} size={size}
        progress={progress} eventToken={eventToken}/>
    </button>
  );
}

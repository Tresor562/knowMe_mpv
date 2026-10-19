'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useKnowMeDocumentVisible } from './knowme-document-visibility';
import { useKnowMeIconViewportVisible } from './knowme-icon-viewport';
import './knowme-gift-artwork.css';

export type KnowMeGiftVariant = 'aurora' | 'cosmos' | 'blossom';
export type KnowMeGiftState = 'idle' | 'opening' | 'opened' | 'claimed';

type Props = {
  variant: KnowMeGiftVariant;
  state?: KnowMeGiftState;
  size?: number;
  className?: string;
  /** Only increment after a confirmed action. An initial idle card never bursts. */
  eventToken?: string | number | null;
  label?: string;
  /** Local preview override; persisted reward state is unchanged. */
  motionEnabled?: boolean;
};

const PALETTES: Record<KnowMeGiftVariant, {
  top: string; side: string; dark: string; light: string; ribbon: string; gem: string;
}> = {
  aurora: {
    top: '#a5faff', side: '#3971f2', dark: '#3824a7',
    light: '#6ce9ff', ribbon: '#fa4cc5', gem: '#ffe2ff'
  },
  cosmos: {
    top: '#b9a0ff', side: '#6a42e7', dark: '#24114b',
    light: '#9b77ff', ribbon: '#f6b749', gem: '#bfe6ff'
  },
  blossom: {
    top: '#ffbdde', side: '#ee6496', dark: '#8a285c',
    light: '#ffe3f0', ribbon: '#69dfbd', gem: '#fff0a6'
  }
};

/**
 * An original layered vector collectible, not a screenshot or asset from
 * Telegram. Separate surface/body/ribbon paths support depth and lid states.
 * Parent product screens own entitlement and may pass 'claimed' only after
 * server confirmation; this illustration never changes reward ownership.
 */
export function KnowMeGiftArtwork({
  variant, state = 'idle', size = 128, eventToken = null,
  className = '', label, motionEnabled = true
}: Props) {
  const id = useId().replace(/:/g, '');
  const gradient = (name: string) => `url(#km-gift-${id}-${name})`;
  const p = PALETTES[variant];
  const previous = useRef({ state, eventToken });
  const [burst, setBurst] = useState(false);
  const documentVisible = useKnowMeDocumentVisible();
  const { ref, visible: inViewport } = useKnowMeIconViewportVisible(
    state === 'opening' || state === 'opened' || state === 'claimed'
  );
  const visible = documentVisible && inViewport;

  useEffect(() => {
    const before = previous.current;
    previous.current = { state, eventToken };
    if (!visible || !motionEnabled) { setBurst(false); return; }
    const changed = before.state !== state ||
      (eventToken !== null && eventToken !== before.eventToken);
    if (!changed || state === 'idle') return;
    const preferences = document.documentElement.dataset;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      preferences.animations === 'false' ||
      preferences.animatedIcons === 'false' ||
      preferences.effectiveReducedMotion === 'true') return;
    setBurst(true);
    const timeout = window.setTimeout(() => setBurst(false), 820);
    return () => window.clearTimeout(timeout);
  }, [state, eventToken, visible, motionEnabled]);

  const fallback = variant === 'aurora' ? 'Cadeau Aurore'
    : variant === 'cosmos' ? 'Cadeau Cosmos' : 'Cadeau Fleur';
  const status = state === 'claimed' ? ' · acquis'
    : state === 'opened' ? ' · ouvert'
    : state === 'opening' ? ' · ouverture en cours' : '';
  return (
    <span ref={ref}
      className={['km-collectible', `km-collectible--${variant}`, className].filter(Boolean).join(' ')}
      data-state={state} data-burst={motionEnabled && burst ? 'true' : 'false'}
      data-visible={visible ? 'true' : 'false'}
      style={{ width: size, height: size }}
    >
      <svg key={eventToken ?? state} viewBox="0 0 128 128" width={size} height={size}
        role="img" aria-label={(label || fallback) + status} focusable="false">
        <defs>
          <linearGradient id={`km-gift-${id}-top`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={p.top}/>
            <stop offset=".58" stopColor={p.light}/>
            <stop offset="1" stopColor={p.side}/>
          </linearGradient>
          <linearGradient id={`km-gift-${id}-side`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={p.side}/>
            <stop offset="1" stopColor={p.dark}/>
          </linearGradient>
          <linearGradient id={`km-gift-${id}-ribbon`} x1=".12" y1="0" x2=".9" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".65"/>
            <stop offset=".24" stopColor={p.ribbon}/>
            <stop offset="1" stopColor={p.dark}/>
          </linearGradient>
          <radialGradient id={`km-gift-${id}-jewel`} cx=".24" cy=".16" r=".9">
            <stop offset="0" stopColor="#fff"/>
            <stop offset=".33" stopColor={p.gem}/>
            <stop offset=".7" stopColor={p.ribbon}/>
            <stop offset="1" stopColor={p.dark}/>
          </radialGradient>
        </defs>
        <ellipse cx="64" cy="112" rx="37" ry="8" fill="#101326" opacity=".16"/>
        <g className="km-collectible-body">
          <path d="M28 56 64 72 99 55v37c0 4-2 6-6 8L67 111c-2 1-5 1-7 0L34 100c-4-2-6-4-6-8Z"
            fill={gradient('side')}/>
          <path d="M28 56 64 72v39c-2 0-4-.3-5-1L34 100c-4-2-6-5-6-8Z"
            fill={gradient('top')} opacity=".86"/>
          <path d="m64 72 35-17v37c0 4-2 6-6 8l-26 11c-1 .4-2 .5-3 .5Z"
            fill={gradient('side')} opacity=".95"/>
          <path d="m55 68 12 5v37l-4 2-8-3Z" fill={gradient('ribbon')}/>
          <path d="M28 79 64 95 99 78v10L64 104 28 88Z"
            fill={gradient('ribbon')} opacity=".8"/>
          <path d="M29 58v31m3 7 24 11m12 2 26-11"
            fill="none" stroke="#fff" strokeOpacity=".23" strokeWidth="1.7"/>
          {/* Hand-authored miniature face engravings distinguish the gifts even
              in grayscale and in Reduce Motion. Never reuse a tint-only icon. */}
          <g className="km-collectible-emblem">
            <ellipse cx="83" cy="88.5" rx="9.5" ry="12"
              fill={gradient('side')} stroke={p.gem} strokeOpacity=".7" strokeWidth="1.2"/>
            <ellipse cx="83" cy="88" rx="8" ry="10.5"
              fill={gradient('jewel')} opacity=".95"/>
            {variant === 'aurora' && <g className="km-collectible-emblem-aurora">
              <path d="M83 78 89 87.5 83 98l-6-10.5Z" fill={p.gem}
                stroke="#fff" strokeWidth=".75" strokeOpacity=".85"/>
              <path d="M83 78 83 98m-6-10.5h12M77 87.5 83 83l6 4.5-6 6Z"
                fill="none" stroke={p.side} strokeWidth=".8" strokeOpacity=".73"/>
              <path d="M92 79v4m-2-2h4" stroke="#fff" strokeWidth=".9" strokeLinecap="round"/>
            </g>}
            {variant === 'cosmos' && <g className="km-collectible-emblem-cosmos">
              <circle cx="83" cy="88" r="5.6" fill={p.side}
                stroke={p.gem} strokeWidth="1"/>
              <path d="M77.2 86.5a15 4.9-24 0 0 12.8 2.9"
                fill="none" stroke="#fff" strokeWidth="1.35" strokeLinecap="round"/>
              <path d="m82 84 1.7-1.8 2 1.8-1.7 1.8Z" fill={p.gem}/>
              <circle cx="79.5" cy="92.5" r="1.15" fill={p.ribbon}/>
            </g>}
            {variant === 'blossom' && <g className="km-collectible-emblem-blossom">
              <ellipse cx="83" cy="83" rx="2.75" ry="4.3" fill={p.gem}/>
              <ellipse cx="83" cy="93" rx="2.75" ry="4.3" fill={p.gem}/>
              <ellipse cx="78.1" cy="88" rx="4.3" ry="2.75" fill={p.gem}/>
              <ellipse cx="87.9" cy="88" rx="4.3" ry="2.75" fill={p.gem}/>
              <ellipse cx="79.6" cy="84.6" rx="2.8" ry="3.8" transform="rotate(-45 79.6 84.6)" fill={p.gem}/>
              <ellipse cx="86.4" cy="91.4" rx="2.8" ry="3.8" transform="rotate(-45 86.4 91.4)" fill={p.gem}/>
              <circle cx="83" cy="88" r="3.5" fill={p.ribbon}
                stroke="#fff" strokeWidth=".85" strokeOpacity=".8"/>
            </g>}
          </g>
        </g>
        <g className="km-collectible-lid">
          <path d="M19 48 58 28c4-2 8-2 12 0l39 20-43 23Z"
            fill={gradient('top')}/>
          <path d="m19 48 47 23v12L20 61c-1-1-1-2-1-3Z"
            fill={gradient('ribbon')}/>
          <path d="m66 71 43-23v12L66 83Z"
            fill={gradient('side')}/>
          <path d="M51 32 62 27 107 50l-12 6Z" fill={gradient('ribbon')}/>
          <path d="M29 53 70 31l9 5-41 21Z" fill={gradient('ribbon')}/>
          <path d="m25 49 35-18M71 30l30 16" stroke="#fff"
            strokeOpacity=".7" strokeWidth="1.6" strokeLinecap="round"/>
          <g className="km-collectible-bow">
            <path d="M64 33c-9-7-21-17-25-9-6 12 15 18 25 9Zm0 0c9-7 21-17 25-9 6 12-15 18-25 9Z"
              fill={gradient('ribbon')} stroke={p.gem} strokeWidth="1.5"/>
            <path d="M57 32c-7-3-12-6-12-7m26 7c7-3 12-6 12-7"
              fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="m63 32-8 20 12-9 10 12-8-23Z"
              fill={gradient('ribbon')} opacity=".9"/>
            <circle cx="64" cy="33" r="6.8" fill={gradient('jewel')} stroke="#fff" strokeOpacity=".75" strokeWidth="1"/>
            {variant === 'aurora' && <g className="km-collectible-crown">
              <path d="m64 18 8 14-8 12-8-12Z" fill={gradient('jewel')}
                stroke="#fff" strokeOpacity=".8" strokeWidth="1.2"/>
              <path d="M64 18v26m-8-12h16" fill="none" stroke="#fff"
                strokeOpacity=".55" strokeWidth="1"/>
            </g>}
            {variant === 'cosmos' && <g className="km-collectible-crown">
              <path d="m64 14 4.2 12 12 4-12 4.2L64 46l-4.2-11.8-12-4.2 12-4Z"
                fill={gradient('jewel')} stroke="#fff" strokeOpacity=".8" strokeWidth="1.1"/>
              <circle cx="64" cy="30" r="2.8" fill="#fff" opacity=".82"/>
            </g>}
            {variant === 'blossom' && <g className="km-collectible-crown">
              <ellipse cx="64" cy="20" rx="5.5" ry="9" fill={gradient('jewel')}/>
              <ellipse cx="53" cy="27" rx="5.5" ry="9" transform="rotate(-48 53 27)" fill={gradient('jewel')}/>
              <ellipse cx="75" cy="27" rx="5.5" ry="9" transform="rotate(48 75 27)" fill={gradient('jewel')}/>
              <circle cx="64" cy="32" r="5.2" fill={p.ribbon} stroke="#fff" strokeWidth="1"/>
            </g>}
          </g>
        </g>
        <g className="km-collectible-magic">
          <path d="m18 25 2.4 6.5 6.5 2.4-6.5 2.4L18 43l-2.4-6.7L9 33.9l6.6-2.4Z"
            fill={p.gem}/>
          <path d="m105 16 1.7 4.8 4.8 1.7-4.8 1.7-1.7 4.8-1.7-4.8-4.8-1.7 4.8-1.7Z"
            fill={p.ribbon}/>
          <circle cx="108" cy="77" r="2.1" fill={p.gem}/>
          <circle cx="15" cy="84" r="1.8" fill={p.ribbon}/>
          {variant === 'cosmos' && <path d="M91 12Q115 34 120 57" fill="none"
            stroke={p.gem} strokeWidth="2.4" strokeLinecap="round" opacity=".72"/>}
          {variant === 'blossom' && <g fill={p.gem} opacity=".8">
            <ellipse cx="18" cy="18" rx="3" ry="6" transform="rotate(38 18 18)"/>
            <ellipse cx="112" cy="46" rx="3" ry="6" transform="rotate(-38 112 46)"/>
          </g>}
          {variant === 'aurora' && <path d="M17 91Q10 67 18 54" fill="none"
            stroke={p.top} strokeWidth="2" strokeLinecap="round" opacity=".75"/>}
        </g>
      </svg>
    </span>
  );
}

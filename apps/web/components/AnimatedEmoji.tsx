'use client';

import { useMemo, useState } from 'react';
import { KnowMeMentionText } from './knowme-mention-text';
import {
  getAnimatedEmojiMotion,
  isStandaloneAnimatedEmojiText,
  splitAnimatedEmojiText
} from '@knowme/animation-contract';

/** Reusable visual with Unicode fallback: the animation never changes the message. */
export function AnimatedEmojiGlyph({ glyph }: { glyph: string }) {
  const motion = getAnimatedEmojiMotion(glyph);
  return <span aria-hidden="true" className={motion
    ? `km-animated-emoji km-emoji-motion-${motion}`
    : 'km-animated-emoji'}>{glyph}</span>;
}

function TappableEmoji({ glyph, large }: { glyph: string; large: boolean }) {
  // A new keyed glyph restarts just this animation on tap, without looping.
  const [replay, setReplay] = useState(0);
  return <button
    className={large ? 'km-emoji-play km-emoji-play-large' : 'km-emoji-play'}
    type="button"
    aria-label={`Animer ${glyph}`}
    onClick={() => setReplay(value => value + 1)}
  ><span key={replay}><AnimatedEmojiGlyph glyph={glyph}/></span></button>;
}

export function AnimatedEmojiText({ text }: { text: string }) {
  const parts = useMemo(() => splitAnimatedEmojiText(text), [text]);
  const large = isStandaloneAnimatedEmojiText(text);
  return <div className={large ? 'km-message-emoji-only' : undefined}
    style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
    {parts.map((part, index) => part.kind === 'emoji'
      ? <TappableEmoji key={index} glyph={part.value} large={large}/>
      : <span key={index}><KnowMeMentionText text={part.value}/></span>)}
  </div>;
}

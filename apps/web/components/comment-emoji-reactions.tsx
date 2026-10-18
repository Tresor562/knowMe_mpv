'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import './comment-emoji-reactions.css';

type ReactionSummary = {
  commentId: string;
  total: number;
  emojis: Array<{emoji: string; count: number}>;
  mine: string | null;
};

const QUICK_EMOJIS = ['❤️','😂','😮','😢','😡'] as const;
const ADDITIONAL_EMOJIS = ['👍','👏','🔥','🥰','😍','🙏','💯','🎉','😎','💔','🤯','🤗','💪','😴','🤔','🤣','🫶','🥹','🌟','✅','👀','🙌','🥳','💙'] as const;

/** Real persisted reactions, not decorative counts. */
export function CommentEmojiReactions({ postId, commentId }: {
  postId: string; commentId: string;
}) {
  const [summary, setSummary] = useState<ReactionSummary | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [more, setMore] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const inflight = useRef(false);

  const endpoint = `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/reactions`;

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    void apiFetch<ReactionSummary>(endpoint).then(data => {
      if (!cancelled) setSummary(data);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      if (longPress.current !== null) clearTimeout(longPress.current);
    };
  }, [endpoint]);

  async function react(emoji: string) {
    if (!emoji || inflight.current) return;
    inflight.current = true;
    setPending(true);
    setError('');
    try {
      const remove = summary?.mine === emoji;
      const result = await apiFetch<ReactionSummary>(endpoint, remove
        ? {method:'DELETE'}
        : {method:'PUT',body:JSON.stringify({emoji})});
      setSummary(result);
      setExpanded(false);
      setMore(false);
      setCustomEmoji('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Réaction indisponible.');
    } finally {
      inflight.current = false;
      setPending(false);
    }
  }

  function cancelHold() {
    if (longPress.current !== null) clearTimeout(longPress.current);
    longPress.current = null;
  }

  function startHold(pointerType: string) {
    if (pointerType === 'mouse') return;
    cancelHold();
    suppressClick.current = false;
    longPress.current = setTimeout(() => {
      suppressClick.current = true;
      setExpanded(true);
    }, 440);
  }

  const emoji = summary?.mine || '♡';
  const count = summary?.total ?? 0;
  return (
    <span className="km-comment-emoji" onKeyDown={event => {
      if (event.key === 'Escape') {setExpanded(false);setMore(false);}
    }}>
      <button type="button" disabled={pending}
        className="km-comment-emoji-main"
        aria-label={summary?.mine ? 'Modifier la réaction au commentaire' : 'Réagir au commentaire'}
        aria-expanded={expanded}
        onPointerDown={event => startHold(event.pointerType)}
        onPointerUp={cancelHold} onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
        onContextMenu={event => {event.preventDefault();cancelHold();setExpanded(true);}}
        onClick={() => {
          if (suppressClick.current) {suppressClick.current=false;return;}
          void react('❤️');
        }}>
        <span aria-hidden="true">{emoji}</span>
        <span>{count>0?count:'J’aime'}</span>
      </button>
      <button type="button" className="km-comment-emoji-expand"
        aria-label="Choisir une réaction emoji" aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
          stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c2 2.5 5 2.5 7 0M9 9h.01M15 9h.01"/>
        </svg>
      </button>
      {expanded && (
        <span className="km-comment-emoji-popover" role="group" aria-label="Choisir une réaction">
          <span className="km-comment-emoji-picker">
            {QUICK_EMOJIS.map(choice => (
              <button type="button" key={choice} disabled={pending}
                aria-label={`Réagir ${choice}`} aria-pressed={summary?.mine===choice}
                onClick={() => void react(choice)}>{choice}</button>
            ))}
            <button type="button" aria-label="Plus d'emojis" onClick={() => setMore(v=>!v)}>＋</button>
          </span>
          {more && (
            <span className="km-comment-emoji-more">
              {ADDITIONAL_EMOJIS.map(choice => (
                <button type="button" key={choice} disabled={pending}
                  aria-label={`Réagir ${choice}`} aria-pressed={summary?.mine===choice}
                  onClick={() => void react(choice)}>{choice}</button>
              ))}
              <span className="km-comment-emoji-custom">
                <input type="text" value={customEmoji} onChange={e=>setCustomEmoji(e.target.value)}
                  aria-label="Autre emoji" placeholder="Autre emoji" maxLength={32}/>
                <button type="button" disabled={pending||!customEmoji.trim()}
                  onClick={() => void react(customEmoji.trim())}>OK</button>
              </span>
            </span>
          )}
          {error && <span role="alert" className="km-comment-emoji-error">{error}</span>}
        </span>
      )}
    </span>
  );
}

'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import './post-action-bar.css';

/** Explicit action contract: the parent must persist any mutation on the server. */
export type PostActionBarProps = {
  postId: string;
  en: boolean;
  likeCount: number;
  commentCount: number;
  selectedReaction?: string | null;
  reactionCounts?: Array<{ emoji: string; count: number }>;
  saved?: boolean;
  online?: boolean;
  onHeart: () => Promise<void>;
  /** Required to remove a selected non-heart emoji; never assume PUT toggles. */
  onRemoveReaction?: () => Promise<void>;
  onReact: (emoji: string) => Promise<void>;
  onComments: () => void;
  onShare: () => void;
  onSave?: () => Promise<void>;
};

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡'] as const;

type IconName = 'heart' | 'comment' | 'share' | 'bookmark' | 'chevron';
function Icon({ name, active = false }: { name: IconName; active?: boolean }) {
  const paths = {
    heart: <path d="M20.8 4.9a5.4 5.4 0 0 0-7.7 0L12 6l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.8-8.4a5.4 5.4 0 0 0 0-7.7Z" />,
    comment: <path d="M20.5 11.4a8.5 8.5 0 0 1-8.5 8.5 9.5 9.5 0 0 1-3.6-.8L3 21l1.8-5.3a8.5 8.5 0 1 1 15.7-4.3Z" />,
    share: <><path d="M12 16V3m0 0L7.7 7.3M12 3l4.3 4.3" /><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
    bookmark: <path d="M6 3.6h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.6a1 1 0 0 1 1-1Z" />,
    chevron: <path d="m7 10 5 5 5-5" />
  };
  return <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true"
    fill={active && (name === 'heart' || name === 'bookmark') ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {paths[name]}
  </svg>;
}

function validCustomReaction(value: string) {
  const candidate = value.trim();
  // Supports compound emoji, flags and ZWJ sequences from the system emoji keyboard.
  const withoutKeycaps = candidate.replace(/[0-9#*]\uFE0F?\u20E3/gu, '');
  return candidate.length > 0 && candidate.length <= 32 &&
    /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{20e3}]/u.test(candidate) &&
    !/[\p{Letter}\p{Number}\p{Punctuation}]/u.test(withoutKeycaps);
}

/**
 * Compact social footer. Tap heart = like. Long press heart or the adjacent
 * chevron = reaction picker with five favorites and the system emoji keyboard.
 * Never changes counts or "saved" locally before a server-confirmed callback.
 */
export function PostActionBar({
  postId, en, likeCount, commentCount, selectedReaction = null,
  reactionCounts = [], saved = false, online = true,
  onHeart, onRemoveReaction, onReact, onComments, onShare, onSave
}: PostActionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allEmojiOpen, setAllEmojiOpen] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const suppressTap = useRef(false);
  const pickerButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const firstReaction = useRef<HTMLButtonElement>(null);

  function cancelLongPress() {
    if (pressTimer.current !== null) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pointerStart.current = null;
  }
  function openPicker() {
    if (!online || busy) return;
    setError('');
    setAllEmojiOpen(false);
    setCustomEmoji('');
    setPickerOpen(true);
  }
  function closePicker() {
    if (busy) return;
    setPickerOpen(false);
    setAllEmojiOpen(false);
    setError('');
    pickerButton.current?.focus();
  }
  useEffect(() => () => cancelLongPress(), []);
  useEffect(() => {
    if (!pickerOpen) return;
    firstReaction.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePicker();
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const controls = Array.from(dialog.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled)'
      )).filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerOpen, busy]);

  async function execute(action: () => Promise<void>, reaction = false) {
    if (inFlight.current || !online) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      if (reaction) {
        setPickerOpen(false);
        setAllEmojiOpen(false);
        pickerButton.current?.focus();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message :
        en ? 'Action not confirmed. Please retry.' : 'Action non confirmée. Réessaie.');
    } finally { inFlight.current = false; setBusy(false); }
  }
  function onHeartPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!online || busy || event.button !== 0) return;
    cancelLongPress();
    pointerStart.current = { x: event.clientX, y: event.clientY };
    suppressTap.current = false;
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      suppressTap.current = true;
      openPicker();
    }, 450);
  }
  function onHeartPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const point = pointerStart.current;
    if (point && Math.hypot(event.clientX - point.x, event.clientY - point.y) > 12) {
      cancelLongPress();
    }
  }
  function heartTap() {
    if (suppressTap.current) { suppressTap.current = false; return; }
    // The historical /like endpoint toggles hearts. Non-heart emoji need an
    // explicit DELETE callback rather than silently adding a heart instead.
    if (selectedReaction && selectedReaction !== '❤️') {
      if (onRemoveReaction) void execute(onRemoveReaction);
      return;
    }
    void execute(onHeart);
  }
  async function selectReaction(emoji: string) {
    await execute(() => onReact(emoji), true);
  }
  const heartActive = selectedReaction !== null;
  const heartIsSelected = selectedReaction === '❤️';
  const canToggle = !selectedReaction || heartIsSelected || Boolean(onRemoveReaction);
  return (
    <div className="km-post-action-area" data-post-id={postId}>
      {reactionCounts.length > 0 && (
        <div className="km-post-reaction-summary" aria-label={en ? 'Reaction totals' : 'Total des réactions'}>
          {reactionCounts.filter(item => item.count > 0).slice(0, 5).map(item => (
            <span key={item.emoji}>{item.emoji} <span>{item.count}</span></span>
          ))}
        </div>
      )}
      <div className="km-post-action-totals">
        <span aria-label={en ? 'Total likes' : 'Total des mentions J’aime'}>❤️ {likeCount}</span>
        <span>{commentCount} {en ? 'comments' : 'commentaires'}</span>
      </div>
      <div className="km-post-action-bar" role="group"
        aria-label={en ? 'Publication actions' : 'Actions de la publication'}>
        <button type="button" className="km-post-action km-post-heart"
          disabled={!online || busy || !canToggle} aria-pressed={heartActive}
          aria-label={heartActive
            ? (en ? 'Remove my reaction' : 'Retirer ma réaction')
            : (en ? 'Like publication' : 'J’aime la publication')}
          aria-haspopup="dialog"
          onPointerDown={onHeartPointerDown} onPointerMove={onHeartPointerMove}
          onPointerCancel={cancelLongPress} onPointerLeave={cancelLongPress}
          onPointerUp={cancelLongPress}
          onKeyDown={event => { if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') { event.preventDefault(); openPicker(); } }}
          onContextMenu={event => { event.preventDefault(); openPicker(); }}
          onClick={heartTap}>
          {selectedReaction && selectedReaction !== '❤️'
            ? <span className="km-post-selected-emoji" aria-hidden="true">{selectedReaction}</span>
            : <Icon name="heart" active={heartIsSelected}/>}
          <span className="km-post-action-label">{selectedReaction && selectedReaction !== '❤️'
            ? selectedReaction : (en ? 'Like' : 'J’aime')}</span>
        </button>
        <button type="button" className="km-post-action" onClick={onComments}
          aria-label={en ? 'View comments' : 'Commenter la publication'}>
          <Icon name="comment"/><span className="km-post-action-label">{en ? 'Comment' : 'Commenter'}</span>
        </button>
        <button type="button" className="km-post-action" onClick={onShare}
          aria-label={en ? 'Share publication' : 'Partager la publication'}>
          <Icon name="share"/><span className="km-post-action-label">{en ? 'Share' : 'Partager'}</span>
        </button>
        <button type="button" className="km-post-action km-post-save"
          disabled={!onSave || !online || busy}
          title={!onSave ? (en ? 'Saving is not available on the server yet' : 'Enregistrement indisponible sur le serveur pour le moment') : undefined}
          aria-label={!onSave ? (en ? 'Saving is currently unavailable' : 'Enregistrement actuellement indisponible')
            : saved ? (en ? 'Remove from saved' : 'Retirer des favoris')
            : (en ? 'Save publication' : 'Enregistrer la publication')}
          aria-pressed={saved} onClick={() => { if (onSave) void execute(onSave); }}>
          <Icon name="bookmark" active={saved}/>
          <span className="km-post-action-label">{saved ? (en ? 'Saved' : 'Enregistré')
            : (en ? 'Save' : 'Enregistrer')}</span>
        </button>
      </div>
      {error && !pickerOpen && <p role="alert" className="km-post-action-error">{error}</p>}
      {pickerOpen && (
        <div className="km-post-reaction-scrim" onMouseDown={event => {
          if (event.currentTarget === event.target) closePicker();
        }}>
          <div className="km-post-reaction-sheet" role="dialog" ref={dialog}
            aria-modal="true" aria-label={en ? 'React to publication' : 'Réagir à la publication'}>
            <div className="km-post-reaction-sheet-head">
              <strong>{en ? 'Choose a reaction' : 'Choisir une réaction'}</strong>
              <button type="button" onClick={closePicker} disabled={busy}
                aria-label={en ? 'Close reactions' : 'Fermer les réactions'}>×</button>
            </div>
            <div className="km-post-reaction-choices">
              {QUICK_REACTIONS.map((emoji, index) => (
                <button key={emoji} type="button" disabled={busy}
                  ref={index === 0 ? firstReaction : undefined}
                  aria-pressed={selectedReaction === emoji}
                  aria-label={en ? `React with ${emoji}` : `Réagir avec ${emoji}`}
                  onClick={() => void selectReaction(emoji)}>{emoji}</button>
              ))}
              <button type="button" disabled={busy} aria-expanded={allEmojiOpen}
                aria-label={en ? 'More emoji reactions' : 'Toutes les réactions emoji'}
                onClick={() => setAllEmojiOpen(value => !value)}>+</button>
            </div>
            {allEmojiOpen && (
              <form className="km-post-custom-reaction" onSubmit={event => {
                event.preventDefault();
                if (validCustomReaction(customEmoji)) void selectReaction(customEmoji.trim());
              }}>
                <label htmlFor={`post-reaction-${postId}`}>
                  {en ? 'Choose an emoji using your keyboard' : 'Choisis un emoji avec ton clavier'}
                </label>
                <div>
                  <input id={`post-reaction-${postId}`} type="text" value={customEmoji}
                    onChange={event => setCustomEmoji(event.target.value)}
                    maxLength={32} autoFocus inputMode="text" placeholder="😀"/>
                  <button type="submit" disabled={busy || !validCustomReaction(customEmoji)}>
                    {en ? 'React' : 'Réagir'}
                  </button>
                </div>
              </form>
            )}
            {error && <p role="alert" className="km-post-action-error">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

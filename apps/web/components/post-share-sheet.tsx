'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';

function ShareGlyph({ name }: { name: 'feed' | 'story' | 'apps' | 'link' }) {
  const common = { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor',
    strokeWidth:2, strokeLinecap:'round' as const, strokeLinejoin:'round' as const,
    width:23, height:23, 'aria-hidden':true as const };
  if (name === 'feed') return <svg {...common}><path d="M4 11.5 12 5l8 6.5V20H4v-8.5Z"/><path d="M9 20v-6h6v6"/></svg>;
  if (name === 'story') return <svg {...common}><circle cx="12" cy="12" r="9" strokeDasharray="3 2"/><path d="M12 8v8m-4-4h8"/></svg>;
  if (name === 'apps') return <svg {...common}><path d="M12 15V3m0 0L8 7m4-4 4 4M5 13v6h14v-6"/></svg>;
  return <svg {...common}><path d="M10 13a5 5 0 0 0 7.5.2l2-2a5 5 0 0 0-7.1-7.1l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.2l-2 2a5 5 0 0 0 7.1 7.1l1.5-1.5"/></svg>;
}

export type ShareablePost = {
  id: string;
  content: string;
  author: { displayName: string };
  imageUrl?: string | null;
};

export function PostShareSheet({ post, onClose, onPublished, en }: {
  post: ShareablePost;
  onClose: () => void;
  onPublished: () => void;
  en: boolean;
}) {
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<'FRIENDS' | 'PUBLIC'>('FRIENDS');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const previousFocus = useRef<HTMLElement | null>(null);
  const url = typeof window === 'undefined' ? '' :
    `${window.location.origin}/feed/${encodeURIComponent(post.id)}`;

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      previousFocus.current?.focus();
    };
  }, [onClose]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback(en ? 'Link copied.' : 'Lien copié.');
    } catch {
      setFeedback(en ? 'Copy unavailable on this device.' : 'Copie indisponible sur cet appareil.');
    }
  }

  async function shareOutside() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${post.author.displayName} · KnowMe`, url });
      } else {
        await copyLink();
      }
    } catch (cause) {
      if ((cause as Error)?.name !== 'AbortError') {
        setFeedback(en ? 'Sharing unavailable.' : 'Partage indisponible.');
      }
    }
  }

  async function shareToFeed() {
    if (busy) return;
    setBusy(true);
    setFeedback('');
    try {
      const text = [
        caption.trim(),
        `${post.author.displayName} · KnowMe`,
        url
      ].filter(Boolean).join('\n\n');
      // The existing public Post API accepts text, not embedded repost objects.
      // This creates a real post containing the original attribution and URL.
      await apiFetch('/posts', { method: 'POST', body: JSON.stringify({ content: text }) });
      onPublished();
      onClose();
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : (en ? 'Could not publish.' : 'Publication impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function shareToStory() {
    if (busy) return;
    setBusy(true);
    setFeedback('');
    try {
      await apiFetch('/stories', { method: 'POST', body: JSON.stringify({
        type: 'LINK', linkUrl: url, caption: caption.trim() || undefined,
        audience, durationHours: 24, allowSharing: true, allowReplies: true,
        allowReactions: true
      }) });
      onPublished();
      onClose();
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : (en ? 'Could not share to Story.' : 'Partage en story impossible.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="km-share-overlay" role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="km-share-sheet" role="dialog" aria-modal="true"
        aria-label={en ? 'Share publication' : 'Partager la publication'}>
        <div className="km-share-handle" aria-hidden="true"/>
        <header className="km-share-header">
          <h2>{en ? 'Share post' : 'Partager la publication'}</h2>
          <button type="button" className="km-share-close" onClick={onClose} disabled={busy}
            aria-label={en ? 'Close' : 'Fermer'}>×</button>
        </header>
        <div className="km-share-source">
          <strong>{post.author.displayName}</strong>
          <p>{post.content}</p>
        </div>
        <label className="km-share-compose-label" htmlFor="knowme-share-caption">
          {en ? 'Say something about this…' : 'Ajouter un commentaire au partage…'}
        </label>
        <textarea id="knowme-share-caption" className="km-share-compose" value={caption}
          onChange={event => setCaption(event.target.value)}
          placeholder={en ? 'Your message (optional)' : 'Votre message (facultatif)'}
          rows={2}/>
        <div className="km-share-audience">
          <label htmlFor="knowme-share-audience">{en ? 'Story audience' : 'Audience de la story'}</label>
          <select id="knowme-share-audience" value={audience}
            onChange={event => setAudience(event.target.value as 'FRIENDS'|'PUBLIC')}>
            <option value="FRIENDS">{en ? 'Friends' : 'Amis'}</option>
            <option value="PUBLIC">{en ? 'Public' : 'Public'}</option>
          </select>
        </div>
        <div className="km-share-actions">
          <button type="button" disabled={busy} onClick={() => void shareToFeed()}>
            <ShareGlyph name="feed"/>{en ? 'To my feed' : 'Sur mon profil'}
          </button>
          <button type="button" disabled={busy} onClick={() => void shareToStory()}>
            <ShareGlyph name="story"/>{en ? 'To my Story' : 'Dans ma story'}
          </button>
          <button type="button" disabled={busy} onClick={() => void shareOutside()}>
            <ShareGlyph name="apps"/>{en ? 'Other apps' : 'Autres applis'}
          </button>
          <button type="button" disabled={busy} onClick={() => void copyLink()}>
            <ShareGlyph name="link"/>{en ? 'Copy link' : 'Copier le lien'}
          </button>
        </div>
        {busy && <p role="status" className="km-share-feedback">{en ? 'Sharing…' : 'Partage en cours…'}</p>}
        {feedback && <p role="status" className="km-share-feedback">{feedback}</p>}
      </section>
    </div>
  );
}

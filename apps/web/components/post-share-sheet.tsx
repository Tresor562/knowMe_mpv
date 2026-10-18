'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { KnowMeAnimatedIcon, type KnowMeIconState } from './knowme-animated-icon';

function ShareGlyph({ name, state = 'idle' }: { name: 'feed' | 'story' | 'apps' | 'link' | 'chat'; state?: KnowMeIconState }) {
  const icons = { feed: 'home', story: 'story', apps: 'upload', link: 'copy', chat: 'chats' } as const;
  return <span className="km-share-action-icon" aria-hidden="true"><KnowMeAnimatedIcon name={icons[name]} size={22} state={state}/></span>;
}

type ShareConversation = {
  id: string;
  title?: string | null;
  isGroup: boolean;
  members: Array<{ userId: string; user: { id: string; displayName: string; username: string } }>;
};

function conversationName(conversation: ShareConversation) {
  const name = conversation.title?.trim();
  if (name) return name;
  const members = (conversation.members ?? [])
    .map(member => member.user?.displayName || member.user?.username).filter(Boolean);
  return members.join(', ') || (conversation.isGroup ? 'Groupe KnowMe' : 'Conversation KnowMe');
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
  const [busyOperation, setBusyOperation] = useState<'feed' | 'story' | 'message' | null>(null);
  const [copied, setCopied] = useState(false);
  const submitting = useRef(false);
  const [feedback, setFeedback] = useState('');
  const [showConversations, setShowConversations] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [conversations, setConversations] = useState<ShareConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
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
    setCopied(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
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

  async function showConversationPicker() {
    if (busy) return;
    if (showConversations) { setShowConversations(false); return; }
    setShowConversations(true);
    setFeedback('');
    setLoadingConversations(true);
    try {
      const available = await apiFetch<ShareConversation[]>('/conversations');
      if (!Array.isArray(available)) throw new Error(en ? 'Conversations unavailable.' : 'Conversations indisponibles.');
      setConversations(available);
    } catch (cause) {
      setConversations([]);
      setFeedback(cause instanceof Error ? cause.message : (en ? 'Could not load conversations.' : 'Chargement des conversations impossible.'));
    } finally {
      setLoadingConversations(false);
    }
  }

  async function sendToConversation() {
    if (submitting.current || !selectedConversationId) return;
    const target = conversations.find(conversation => conversation.id === selectedConversationId);
    if (!target) return;
    const content = [caption.trim(), `${post.author.displayName} · KnowMe`, url]
      .filter(Boolean).join('\n\n');
    if (content.length > 4000) {
      setFeedback(en ? 'Message too long (4,000 characters maximum).' : 'Message trop long (4 000 caractères maximum).');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setBusyOperation("message");
    setFeedback('');
    try {
      // Membership and permission checks stay enforced by the Messaging API.
      await apiFetch(`/conversations/${encodeURIComponent(target.id)}/messages`, {
        method: 'POST', body: JSON.stringify({ content })
      });
      onPublished();
      onClose();
    } catch (cause) {
      const error = cause as { code?: string; message?: string };
      const uncertain = error?.code === 'KNOWME_TIMEOUT' || error?.code === 'KNOWME_NETWORK_UNAVAILABLE';
      setFeedback(uncertain
        ? (en ? 'Delivery not confirmed. Check the chat before trying again.' : 'Envoi non confirmé. Vérifie la conversation avant de réessayer.')
        : cause instanceof Error ? cause.message : (en ? 'Could not send message.' : 'Impossible d’envoyer le message.'));
    } finally {
      submitting.current = false;
      setBusy(false);
      setBusyOperation(null);
    }
  }

  async function shareToFeed() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setBusyOperation("feed");
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
      submitting.current = false;
      setBusy(false);
      setBusyOperation(null);
    }
  }

  async function shareToStory() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setBusyOperation("story");
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
      submitting.current = false;
      setBusy(false);
      setBusyOperation(null);
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
            aria-label={en ? 'Close' : 'Fermer'}><KnowMeAnimatedIcon name="close" size={21}/></button>
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
        <p className="km-share-feedback">{en
          ? 'Shares to your feed are public. The audience selector applies to stories only.'
          : 'Les partages sur le fil sont publics. L’audience sélectionnée s’applique seulement aux stories.'}</p>
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
            <ShareGlyph name="feed" state={busyOperation === "feed" ? "sending" : "idle"}/>{en ? 'To my feed' : 'Sur mon profil'}
          </button>
          <button type="button" disabled={busy} onClick={() => void shareToStory()}>
            <ShareGlyph name="story" state={busyOperation === "story" ? "sending" : "idle"}/>{en ? 'To my Story' : 'Dans ma story'}
          </button>
          <button type="button" disabled={busy || loadingConversations} aria-expanded={showConversations}
            onClick={() => void showConversationPicker()}>
            <ShareGlyph name="chat" state={loadingConversations ? "loading" : showConversations ? "open" : "closed"}/>{en ? 'Messages & groups' : 'Messages et groupes'}
          </button>
          <button type="button" disabled={busy} onClick={() => void shareOutside()}>
            <ShareGlyph name="apps"/>{en ? 'Other apps' : 'Autres applis'}
          </button>
          <button type="button" disabled={busy} onClick={() => void copyLink()}>
            <ShareGlyph name="link" state={copied ? "success" : "idle"}/>{copied ? (en ? 'Link copied' : 'Lien copié') : (en ? 'Copy link' : 'Copier le lien')}
          </button>
        </div>
        {showConversations && (
          <section className="km-share-conversations" aria-label={en ? 'Choose a conversation' : 'Choisir une conversation'}>
            <label htmlFor="km-share-recipient-search">{en ? 'Find a conversation or group' : 'Rechercher une conversation ou un groupe'}</label>
            <input id="km-share-recipient-search" value={recipientQuery} onChange={event => setRecipientQuery(event.target.value)}
              placeholder={en ? 'Search conversations' : 'Rechercher des conversations'} disabled={loadingConversations || busy} />
            {loadingConversations && <p role="status">{en ? 'Loading conversations…' : 'Chargement des conversations…'}</p>}
            {!loadingConversations && conversations.length === 0 && <p>{en ? 'No conversation available.' : 'Aucune conversation disponible.'}</p>}
            <div className="km-share-recipient-list" role="radiogroup" aria-label={en ? 'Conversation' : 'Conversation'}>
              {conversations.filter(chat =>
                conversationName(chat).toLocaleLowerCase().includes(recipientQuery.trim().toLocaleLowerCase())
              ).slice(0,40).map(chat => (
                <label className="km-share-recipient" key={chat.id}>
                  <input type="radio" name="km-share-chat" value={chat.id}
                    checked={selectedConversationId === chat.id}
                    disabled={busy}
                    onChange={() => setSelectedConversationId(chat.id)} />
                  <span>
                    <strong>{conversationName(chat)}</strong>
                    <small>{chat.isGroup ? (en ? 'Group' : 'Groupe') : (en ? 'Private chat' : 'Conversation privée')}</small>
                  </span>
                </label>
              ))}
            </div>
            <button type="button" className="km-share-send-message" disabled={busy || !selectedConversationId}
              onClick={() => void sendToConversation()}>
              <KnowMeAnimatedIcon name="send" size={20} state={busyOperation === "message" ? "sending" : "idle"}/>
              {en ? 'Send to selected conversation' : 'Envoyer dans cette conversation'}
            </button>
          </section>
        )}
        {busy && <p role="status" className="km-share-feedback">{en ? 'Sharing…' : 'Partage en cours…'}</p>}
        {feedback && <p role="status" className="km-share-feedback">{feedback}</p>}
      </section>
    </div>
  );
}

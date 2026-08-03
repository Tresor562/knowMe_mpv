'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/api';
import { useSession } from '../../../../lib/use-session';

type Message = {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender?: {
    id: string;
    displayName: string;
    username: string;
  };
};

type ResolvedSticker = {
  payload: {
    conversationId: string;
    packKey: string;
    stickerKey: string;
  };
  pack: {
    key: string;
    version: number;
    name: string;
  };
  sticker: {
    key: string;
    version: number;
    name: string;
    emoji: string;
    altText: string;
    assetToken: string;
  };
  visualOnly: true;
  externalAssetAllowed: false;
  arbitraryHtmlAllowed: false;
};

type DisplayMessage = Message & {
  sticker: ResolvedSticker | null;
  invalidStickerToken: boolean;
};

async function resolveMessage(message: Message, conversationId: string): Promise<DisplayMessage> {
  if (!message.content.startsWith('KNOWME_STICKER_V1.')) {
    return { ...message, sticker: null, invalidStickerToken: false };
  }
  try {
    const response = await fetch('/api/stickers/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: message.content })
    });
    if (!response.ok) {
      return { ...message, sticker: null, invalidStickerToken: true };
    }
    const sticker = (await response.json()) as ResolvedSticker;
    if (sticker.payload.conversationId !== conversationId) {
      return { ...message, sticker: null, invalidStickerToken: true };
    }
    return { ...message, sticker, invalidStickerToken: false };
  } catch {
    return { ...message, sticker: null, invalidStickerToken: true };
  }
}

export default function StickerConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = String(params.conversationId ?? '');
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    if (!user || !conversationId) return;
    setLoading(true);
    try {
      const rows = await apiFetch<Message[]>(
        `/conversations/${encodeURIComponent(conversationId)}/messages`
      );
      setMessages(await Promise.all(rows.map((message) => resolveMessage(message, conversationId))));
      setStatus('');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Messages indisponibles.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement de la conversation…</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 820, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 14,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <small style={{ color: 'var(--mint)' }}>CONVERSATION SIGNÉE</small>
          <h1>Messages et stickers vérifiés</h1>
        </div>
        <button className="btn" onClick={() => void load()} disabled={loading}>
          {loading ? 'Actualisation…' : 'Actualiser'}
        </button>
      </header>

      {status ? <p role="status">{status}</p> : null}

      <section className="grid" style={{ marginTop: 22 }}>
        {messages.map((message) => (
          <article key={message.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>{message.sender?.displayName ?? 'Membre'}</strong>
              <small style={{ color: 'var(--muted)' }}>
                {new Date(message.createdAt).toLocaleString('fr-FR')}
              </small>
            </div>

            {message.sticker ? (
              <div
                aria-label={message.sticker.sticker.altText}
                style={{
                  marginTop: 12,
                  display: 'inline-grid',
                  gap: 8,
                  placeItems: 'center',
                  minWidth: 180,
                  padding: 20,
                  borderRadius: 24,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)'
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 70 }}>
                  {message.sticker.sticker.emoji}
                </span>
                <strong>{message.sticker.sticker.name}</strong>
                <small style={{ color: 'var(--muted)' }}>
                  {message.sticker.pack.name} · signature valide
                </small>
              </div>
            ) : message.invalidStickerToken ? (
              <p style={{ color: 'var(--orange)' }}>
                Sticker non reconnu : la signature, la version ou la conversation ne correspond pas.
              </p>
            ) : (
              <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
            )}
          </article>
        ))}
        {!loading && messages.length === 0 && !status ? (
          <p style={{ color: 'var(--muted)' }}>Aucun message dans cette conversation.</p>
        ) : null}
      </section>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
        <Link className="btn btn-primary" href="/stickers">Envoyer un sticker</Link>
        <Link className="btn" href="/stickers/conversations">Retour aux conversations</Link>
      </div>
    </main>
  );
}

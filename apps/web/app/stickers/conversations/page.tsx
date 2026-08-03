'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Conversation = {
  id: string;
  title?: string | null;
  updatedAt?: string;
  members?: Array<{
    user?: { id: string; displayName: string; username: string };
  }>;
  messages?: Array<{ content: string; createdAt: string }>;
};

function label(conversation: Conversation) {
  if (conversation.title?.trim()) return conversation.title.trim();
  const names = conversation.members
    ?.map((member) => member.user?.displayName)
    .filter(Boolean)
    .join(', ');
  return names || `Conversation ${conversation.id.slice(0, 8)}`;
}

export default function StickerConversationsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [items, setItems] = useState<Conversation[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    apiFetch<Conversation[]>('/conversations')
      .then(setItems)
      .catch((cause) =>
        setMessage(cause instanceof Error ? cause.message : 'Conversations indisponibles.')
      );
  }, [user]);

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement des conversations…</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 900, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>LECTURE STICKER-AWARE</small>
        <h1>Conversations</h1>
        <p style={{ color: 'var(--muted)' }}>
          Cette vue résout les stickers signés sans interpréter les liens, le HTML ou les tokens falsifiés.
        </p>
      </header>

      {message ? <p role="status">{message}</p> : null}

      <section className="grid" style={{ marginTop: 22 }}>
        {items.map((conversation) => (
          <Link
            key={conversation.id}
            href={`/stickers/conversations/${conversation.id}`}
            className="card"
            style={{ padding: 18, textDecoration: 'none' }}
          >
            <strong>{label(conversation)}</strong>
            <div style={{ color: 'var(--muted)', marginTop: 6 }}>
              {conversation.messages?.[0]?.content?.startsWith('KNOWME_STICKER_V1.')
                ? 'Sticker KnowMe signé'
                : conversation.messages?.[0]?.content || 'Aucun message récent'}
            </div>
          </Link>
        ))}
        {items.length === 0 && !message ? (
          <div className="card" style={{ padding: 20 }}>
            <p style={{ color: 'var(--muted)' }}>Aucune conversation disponible.</p>
            <Link className="btn" href="/messages">Créer une conversation</Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type ConversationDraft = {
  userId: string;
  conversationId: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type ConversationDraftList = { items: ConversationDraft[] };

function preview(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}…`;
}

export default function DraftsPage() {
  const { loading } = useSession({ required: true });
  const [items, setItems] = useState<ConversationDraft[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<ConversationDraftList>('/conversation-drafts');
      setItems(response.items);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.');
    }
  }, []);

  useEffect(() => {
    if (!loading) void load();
  }, [load, loading]);

  async function remove(conversationId: string) {
    setBusyId(conversationId);
    try {
      await apiFetch(`/conversation-drafts/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE'
      });
      setItems((current) => current.filter((item) => item.conversationId !== conversationId));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{ maxWidth: 900, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--mint)' }}>MESSAGERIE · BROUILLONS PRIVÉS</small>
          <h1>Brouillons synchronisés</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            {items.length} brouillon(s) encore liés à des conversations accessibles.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void load()}>Actualiser</button>
          <Link className="btn" href="/messages">Retour aux messages</Link>
        </div>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section className="grid" style={{ marginTop: 20, gap: 12 }}>
        {items.map((item) => (
          <article className="card" key={item.conversationId} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong>Brouillon de conversation</strong>
              <small style={{ color: 'var(--muted)' }}>v{item.version}</small>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {preview(item.content) || 'Brouillon vide'}
            </p>
            <small style={{ color: 'var(--muted)' }}>
              Modifié le {new Date(item.updatedAt).toLocaleString('fr-FR')}
            </small>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <Link className="btn btn-primary" href={`/messages/${item.conversationId}`}>
                Reprendre la conversation
              </Link>
              <button
                className="btn"
                disabled={busyId === item.conversationId}
                onClick={() => void remove(item.conversationId)}
              >
                {busyId === item.conversationId ? 'Suppression…' : 'Supprimer le brouillon'}
              </button>
            </div>
          </article>
        ))}

        {!items.length && (
          <div className="card" style={{ padding: 24 }}>
            <h2>Aucun brouillon synchronisé</h2>
            <p style={{ color: 'var(--muted)' }}>
              Les brouillons sont privés et ne deviennent jamais des messages tant que tu ne les envoies pas explicitement.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

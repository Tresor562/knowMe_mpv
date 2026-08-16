'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type SavedMessage = {
  messageId: string;
  savedAt: string;
  message: {
    id: string;
    conversationId: string;
    content: string;
    createdAt: string;
    editedAt?: string | null;
    sender: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl?: string | null;
    };
  };
};

type SavedMessagesResponse = { items: SavedMessage[] };

export default function SavedMessagesPage() {
  const { loading } = useSession({ required: true });
  const [items, setItems] = useState<SavedMessage[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<SavedMessagesResponse>('/saved-messages?limit=100');
      setItems(response.items);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.');
    }
  }, []);

  useEffect(() => {
    if (!loading) void load();
  }, [load, loading]);

  async function remove(messageId: string) {
    setBusyId(messageId);
    try {
      await apiFetch(`/saved-messages/${encodeURIComponent(messageId)}`, {
        method: 'DELETE'
      });
      setItems((current) => current.filter((item) => item.messageId !== messageId));
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
          <small style={{ color: 'var(--mint)' }}>MESSAGERIE · PRIVÉ</small>
          <h1>Messages enregistrés</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            {items.length} message(s) encore accessibles dans tes conversations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => void load()}>Actualiser</button>
          <Link href="/messages" className="btn">Retour aux messages</Link>
        </div>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section className="grid" style={{ marginTop: 20, gap: 12 }}>
        {items.map((item) => (
          <article key={item.messageId} className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong>{item.message.sender.displayName}</strong>
                <small style={{ color: 'var(--muted)', marginLeft: 8 }}>@{item.message.sender.username}</small>
              </div>
              <small style={{ color: 'var(--muted)' }}>
                Enregistré le {new Date(item.savedAt).toLocaleString('fr-FR')}
              </small>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.message.content}</p>
            <small style={{ color: 'var(--muted)' }}>
              Message du {new Date(item.message.createdAt).toLocaleString('fr-FR')}
              {item.message.editedAt ? ' · modifié' : ''}
            </small>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <Link
                className="btn btn-primary"
                href={`/messages/${item.message.conversationId}?message=${encodeURIComponent(item.message.id)}`}
              >
                Ouvrir dans la conversation
              </Link>
              <button
                className="btn"
                disabled={busyId === item.messageId}
                onClick={() => void remove(item.messageId)}
              >
                {busyId === item.messageId ? 'Suppression…' : 'Retirer des enregistrés'}
              </button>
            </div>
          </article>
        ))}
        {!items.length && (
          <div className="card" style={{ padding: 24 }}>
            <h2>Aucun message enregistré</h2>
            <p style={{ color: 'var(--muted)' }}>
              Cette bibliothèque n'accorde jamais un accès supplémentaire : un message retiré ou devenu inaccessible disparaît automatiquement de la liste.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

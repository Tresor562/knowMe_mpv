'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type SavedMessage = {
  messageId: string;
  savedAt: string;
  message: {
    id: string;
    conversationId: string;
    content: string;
    sender: { id: string; username: string; displayName: string };
  };
};

type SavedMessagesResponse = { items: SavedMessage[] };

type AuthorGroup = {
  id: string;
  username: string;
  displayName: string;
  items: SavedMessage[];
};

export default function SavedMessagesByAuthorPage() {
  const { loading } = useSession({ required: true });
  const [items, setItems] = useState<SavedMessage[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    let active = true;
    setBusy(true);
    apiFetch<SavedMessagesResponse>('/saved-messages?limit=100')
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [loading]);

  const groups = useMemo<AuthorGroup[]>(() => {
    const map = new Map<string, AuthorGroup>();
    for (const item of items) {
      const author = item.message.sender;
      const current = map.get(author.id) ?? {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
        items: []
      };
      current.items.push(item);
      map.set(author.id, current);
    }
    return [...map.values()].sort((a, b) => b.items.length - a.items.length || a.displayName.localeCompare(b.displayName));
  }, [items]);

  if (loading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{ maxWidth: 920, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--mint)' }}>MESSAGES ENREGISTRÉS · AUTEURS</small>
          <h1>Messages enregistrés par auteur</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>Ce regroupement est calculé uniquement dans ton navigateur à partir des messages déjà autorisés.</p>
        </div>
        <Link href="/saved-messages" className="btn">Bibliothèque</Link>
      </header>

      {error && <p role="alert" style={{ color: 'var(--orange)' }}>{error}</p>}
      {busy && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      <section className="grid" style={{ gap: 14, marginTop: 20 }}>
        {groups.map((group) => (
          <article className="card" key={group.id} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <strong>{group.displayName}</strong>
                <small style={{ color: 'var(--muted)', marginLeft: 6 }}>@{group.username}</small>
              </div>
              <strong style={{ color: 'var(--mint)' }}>{group.items.length}</strong>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {group.items.map((item) => (
                <Link
                  key={item.messageId}
                  href={`/messages/${item.message.conversationId}?message=${encodeURIComponent(item.message.id)}`}
                  className="card"
                  style={{ padding: 12, display: 'block' }}
                >
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.message.content}</p>
                  <small style={{ color: 'var(--muted)' }}>Enregistré le {new Date(item.savedAt).toLocaleString('fr-FR')}</small>
                </Link>
              ))}
            </div>
          </article>
        ))}
        {!busy && !groups.length && <p style={{ color: 'var(--muted)' }}>Aucun message enregistré.</p>}
      </section>
    </main>
  );
}

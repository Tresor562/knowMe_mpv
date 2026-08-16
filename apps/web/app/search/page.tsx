'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type SearchKind = 'MESSAGE' | 'POST' | 'CHALLENGE' | 'CONVERSATION';

type SearchItem = {
  kind: SearchKind;
  id: string;
  title: string | null;
  snippet: string;
  route: string;
  updatedAt: string;
};

type SearchResponse = {
  query: string;
  items: SearchItem[];
  nextCursor: string | null;
};

const labels: Record<SearchKind, string> = {
  MESSAGE: 'Message',
  POST: 'Publication',
  CHALLENGE: 'Défi',
  CONVERSATION: 'Conversation'
};

export default function UniversalSearchPage() {
  const { loading } = useSession({ required: true });
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) return;

    setBusy(true);
    setMessage('');
    try {
      const result = await apiFetch<SearchResponse>(
        `/search?q=${encodeURIComponent(normalized)}&limit=20`
      );
      setSubmittedQuery(result.query);
      setItems(result.items);
      setNextCursor(result.nextCursor);
      setMessage(result.items.length ? '' : 'Aucun résultat accessible.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Recherche impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || !submittedQuery || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await apiFetch<SearchResponse>(
        `/search?q=${encodeURIComponent(submittedQuery)}&limit=20&cursor=${encodeURIComponent(nextCursor)}`
      );
      setItems((current) => {
        const seen = new Set(current.map((item) => `${item.kind}:${item.id}`));
        return [...current, ...result.items.filter((item) => !seen.has(`${item.kind}:${item.id}`))];
      });
      setNextCursor(result.nextCursor);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="shell"><p>Chargement…</p></main>;

  return (
    <main className="shell" style={{ maxWidth: 960, margin: '0 auto' }}>
      <header style={{ marginBottom: 22 }}>
        <small style={{ color: 'var(--mint)' }}>RECHERCHE UNIVERSELLE</small>
        <h1 style={{ marginBottom: 8 }}>Retrouve ce qui t’appartient</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          KnowMe affiche uniquement les résultats que le serveur t’autorise déjà à consulter.
        </p>
      </header>

      <form
        className="card"
        onSubmit={runSearch}
        style={{ padding: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}
      >
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Message, conversation, publication ou défi…"
          minLength={2}
          maxLength={120}
          required
          autoComplete="off"
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn btn-primary" disabled={busy || query.trim().length < 2}>
          {busy && !items.length ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>

      {message && <p role="status" style={{ color: 'var(--muted)' }}>{message}</p>}

      {submittedQuery && (
        <section style={{ marginTop: 24 }}>
          <h2>Résultats pour « {submittedQuery} »</h2>
          <div className="grid" style={{ gap: 12 }}>
            {items.map((item) => (
              <Link
                href={item.route}
                key={`${item.kind}:${item.id}`}
                className="card"
                style={{ padding: 18, display: 'block' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <strong>{item.title || labels[item.kind]}</strong>
                  <small style={{ color: 'var(--mint)' }}>{labels[item.kind]}</small>
                </div>
                <p style={{ color: 'var(--muted)', marginBottom: 8 }}>{item.snippet}</p>
                <small style={{ color: 'var(--muted)' }}>
                  {new Date(item.updatedAt).toLocaleString()}
                </small>
              </Link>
            ))}
          </div>

          {nextCursor && (
            <button
              className="btn"
              disabled={busy}
              onClick={() => void loadMore()}
              style={{ marginTop: 16 }}
            >
              {busy ? 'Chargement…' : 'Charger plus'}
            </button>
          )}
        </section>
      )}
    </main>
  );
}

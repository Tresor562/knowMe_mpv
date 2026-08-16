'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Pin = {
  userId: string;
  conversationId: string;
  pinnedAt: string;
};

type PinList = { items: Pin[]; limit?: number };

type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{
    userId: string;
    user: { id: string; displayName: string; username: string };
  }>;
};

const MAX_PINS = 5;

export default function ConversationPinsPage() {
  const { user, loading } = useSession({ required: true });
  const [pins, setPins] = useState<Pin[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setMessage('');
    try {
      const [pinData, conversationData] = await Promise.all([
        apiFetch<PinList>('/conversation-pins'),
        apiFetch<Conversation[]>('/conversations')
      ]);
      setPins(pinData.items);
      setConversations(conversationData);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.');
    }
  }, []);

  useEffect(() => {
    if (!loading) void load();
  }, [load, loading]);

  const names = useMemo(() => {
    return new Map(
      conversations.map((conversation) => {
        const peers = conversation.members.filter((member) => member.userId !== user?.id);
        const label = conversation.title || peers.map((member) => member.user.displayName).join(', ') || 'Conversation';
        return [conversation.id, label] as const;
      })
    );
  }, [conversations, user?.id]);

  const pinnedIds = useMemo(() => new Set(pins.map((pin) => pin.conversationId)), [pins]);
  const atLimit = pins.length >= MAX_PINS;

  async function pin(conversationId: string) {
    setBusyId(conversationId);
    setMessage('');
    try {
      await apiFetch(`/conversation-pins/${encodeURIComponent(conversationId)}`, { method: 'PUT' });
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Épinglage impossible.');
    } finally {
      setBusyId(null);
    }
  }

  async function unpin(conversationId: string) {
    setBusyId(conversationId);
    setMessage('');
    try {
      await apiFetch(`/conversation-pins/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Désépinglage impossible.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{ maxWidth: 920, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--mint)' }}>MESSAGERIE · ORGANISATION PRIVÉE</small>
          <h1>Conversations épinglées</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            Tes épingles sont personnelles. Elles ne changent jamais les membres, rôles ou permissions d'une conversation.
          </p>
        </div>
        <Link href="/messages" className="btn">Retour aux messages</Link>
      </header>

      <p style={{ color: 'var(--muted)', marginTop: 14 }}>
        {pins.length}/{MAX_PINS} épingle(s) utilisée(s).
      </p>
      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section style={{ marginTop: 20 }}>
        <h2>Épinglées</h2>
        <div className="grid" style={{ gap: 10 }}>
          {pins.map((pinItem) => (
            <article className="card" key={pinItem.conversationId} style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <strong>{names.get(pinItem.conversationId) ?? 'Conversation'}</strong>
                  <small style={{ display: 'block', color: 'var(--muted)', marginTop: 4 }}>
                    Épinglée le {new Date(pinItem.pinnedAt).toLocaleString('fr-FR')}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link className="btn" href={`/messages/${pinItem.conversationId}`}>Ouvrir</Link>
                  <button
                    className="btn"
                    disabled={busyId === pinItem.conversationId}
                    onClick={() => void unpin(pinItem.conversationId)}
                  >
                    {busyId === pinItem.conversationId ? 'Retrait…' : 'Désépingler'}
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!pins.length && <p style={{ color: 'var(--muted)' }}>Aucune conversation épinglée.</p>}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Autres conversations</h2>
        {atLimit && (
          <p style={{ color: 'var(--muted)' }}>
            La limite de {MAX_PINS} est atteinte. Désépingle une conversation avant d'en ajouter une autre.
          </p>
        )}
        <div className="grid" style={{ gap: 10 }}>
          {conversations.filter((conversation) => !pinnedIds.has(conversation.id)).map((conversation) => (
            <article className="card" key={conversation.id} style={{ padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Link href={`/messages/${conversation.id}`}><strong>{names.get(conversation.id)}</strong></Link>
              <button
                className="btn btn-primary"
                disabled={atLimit || busyId === conversation.id}
                onClick={() => void pin(conversation.id)}
              >
                {busyId === conversation.id ? 'Épinglage…' : 'Épingler'}
              </button>
            </article>
          ))}
          {!conversations.filter((conversation) => !pinnedIds.has(conversation.id)).length && (
            <p style={{ color: 'var(--muted)' }}>Aucune autre conversation accessible.</p>
          )}
        </div>
      </section>
    </main>
  );
}

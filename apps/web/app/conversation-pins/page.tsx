'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Pin = {
  userId: string;
  conversationId: string;
  pinnedAt: string;
  position: number;
};

type PinList = {
  items: Pin[];
  limit: number;
  remaining: number;
  canPinMore: boolean;
};

type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{
    userId: string;
    user: { id: string; displayName: string; username: string };
  }>;
};

export default function ConversationPinsPage() {
  const { user, loading } = useSession({ required: true });
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinLimit, setPinLimit] = useState<number | null>(null);
  const [pinRemaining, setPinRemaining] = useState<number | null>(null);
  const [canPinMore, setCanPinMore] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setMessage('');
    try {
      const [pinData, conversationData] = await Promise.all([
        apiFetch<PinList>('/conversation-pins'),
        apiFetch<Conversation[]>('/conversations')
      ]);
      setPins(pinData.items);
      setPinLimit(pinData.limit);
      setPinRemaining(pinData.remaining);
      setCanPinMore(pinData.canPinMore);
      setConversations(conversationData);
    } catch (cause) {
      setPinLimit(null);
      setPinRemaining(null);
      setCanPinMore(null);
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
  const capacityKnown = pinLimit !== null && pinRemaining !== null && canPinMore !== null;

  async function pin(conversationId: string) {
    if (!capacityKnown || !canPinMore) {
      setMessage(capacityKnown ? `La limite de ${pinLimit} conversations épinglées est atteinte.` : 'Capacité d’épinglage indisponible.');
      return;
    }
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

  async function movePin(index: number, direction: -1 | 1) {
    if (ordering || busyId !== null) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pins.length) return;

    const next = [...pins];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setOrdering(true);
    setMessage('');
    try {
      await apiFetch('/conversation-pins/order', {
        method: 'PUT',
        body: JSON.stringify({ conversationIds: next.map((pinItem) => pinItem.conversationId) })
      });
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Réorganisation impossible.');
      await load();
    } finally {
      setOrdering(false);
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
            Tes épingles et leur ordre sont personnels. Ils ne changent jamais les membres, rôles ou permissions d'une conversation.
          </p>
        </div>
        <Link href="/messages" className="btn">Retour aux messages</Link>
      </header>

      <p style={{ color: 'var(--muted)', marginTop: 14 }}>
        {!capacityKnown
          ? `${pins.length} épingle(s)`
          : `${pins.length}/${pinLimit} épingle(s) utilisée(s) · ${pinRemaining} restante(s).`}
      </p>
      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section style={{ marginTop: 20 }}>
        <h2>Épinglées</h2>
        <p style={{ color: 'var(--muted)' }}>Utilise les flèches pour définir l'ordre affiché. Le serveur reste l'autorité de l'ordre enregistré.</p>
        <div className="grid" style={{ gap: 10 }}>
          {pins.map((pinItem, index) => (
            <article className="card" key={pinItem.conversationId} style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <strong>{names.get(pinItem.conversationId) ?? 'Conversation'}</strong>
                  <small style={{ display: 'block', color: 'var(--muted)', marginTop: 4 }}>
                    Position {index + 1} · épinglée le {new Date(pinItem.pinnedAt).toLocaleString('fr-FR')}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    aria-label={`Monter ${names.get(pinItem.conversationId) ?? 'la conversation'}`}
                    title="Monter"
                    disabled={ordering || busyId !== null || index === 0}
                    onClick={() => void movePin(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="btn"
                    aria-label={`Descendre ${names.get(pinItem.conversationId) ?? 'la conversation'}`}
                    title="Descendre"
                    disabled={ordering || busyId !== null || index === pins.length - 1}
                    onClick={() => void movePin(index, 1)}
                  >
                    ↓
                  </button>
                  <Link className="btn" href={`/messages/${pinItem.conversationId}`}>Ouvrir</Link>
                  <button
                    className="btn"
                    disabled={ordering || busyId === pinItem.conversationId}
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
        {capacityKnown && !canPinMore && (
          <p style={{ color: 'var(--muted)' }}>
            La limite de {pinLimit} est atteinte. Désépingle une conversation avant d'en ajouter une autre.
          </p>
        )}
        <div className="grid" style={{ gap: 10 }}>
          {conversations.filter((conversation) => !pinnedIds.has(conversation.id)).map((conversation) => (
            <article className="card" key={conversation.id} style={{ padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Link href={`/messages/${conversation.id}`}><strong>{names.get(conversation.id)}</strong></Link>
              <button
                className="btn btn-primary"
                disabled={ordering || !capacityKnown || !canPinMore || busyId === conversation.id}
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

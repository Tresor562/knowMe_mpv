'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Archive = {
  userId: string;
  conversationId: string;
  archivedAt: string;
};

type ArchiveList = { items: Archive[] };

type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{
    userId: string;
    user: { id: string; displayName: string; username: string };
  }>;
};

export default function ConversationArchivesPage() {
  const { user, loading } = useSession({ required: true });
  const [archives, setArchives] = useState<Archive[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setMessage('');
    try {
      const [archiveData, conversationData] = await Promise.all([
        apiFetch<ArchiveList>('/conversation-archives'),
        apiFetch<Conversation[]>('/conversations')
      ]);
      setArchives(archiveData.items);
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

  const archivedIds = useMemo(
    () => new Set(archives.map((archive) => archive.conversationId)),
    [archives]
  );

  async function archive(conversationId: string) {
    setBusyId(conversationId);
    setMessage('');
    try {
      await apiFetch(`/conversation-archives/${encodeURIComponent(conversationId)}`, {
        method: 'PUT'
      });
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Archivage impossible.');
    } finally {
      setBusyId(null);
    }
  }

  async function restore(conversationId: string) {
    setBusyId(conversationId);
    setMessage('');
    try {
      await apiFetch(`/conversation-archives/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE'
      });
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Restauration impossible.');
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
          <h1>Conversations archivées</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            L'archivage est personnel : il ne quitte pas la conversation et ne coupe pas les notifications.
          </p>
        </div>
        <Link href="/messages" className="btn">Retour aux messages</Link>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section style={{ marginTop: 20 }}>
        <h2>Archivées</h2>
        <div className="grid" style={{ gap: 10 }}>
          {archives.map((archiveItem) => (
            <article className="card" key={archiveItem.conversationId} style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <strong>{names.get(archiveItem.conversationId) ?? 'Conversation'}</strong>
                  <small style={{ display: 'block', color: 'var(--muted)', marginTop: 4 }}>
                    Archivée le {new Date(archiveItem.archivedAt).toLocaleString('fr-FR')}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link className="btn" href={`/messages/${archiveItem.conversationId}`}>Ouvrir</Link>
                  <button
                    className="btn btn-primary"
                    disabled={busyId === archiveItem.conversationId}
                    onClick={() => void restore(archiveItem.conversationId)}
                  >
                    {busyId === archiveItem.conversationId ? 'Restauration…' : 'Restaurer'}
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!archives.length && <p style={{ color: 'var(--muted)' }}>Aucune conversation archivée.</p>}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Conversations actives</h2>
        <div className="grid" style={{ gap: 10 }}>
          {conversations.filter((conversation) => !archivedIds.has(conversation.id)).map((conversation) => (
            <article className="card" key={conversation.id} style={{ padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Link href={`/messages/${conversation.id}`}><strong>{names.get(conversation.id)}</strong></Link>
              <button
                className="btn"
                disabled={busyId === conversation.id}
                onClick={() => void archive(conversation.id)}
              >
                {busyId === conversation.id ? 'Archivage…' : 'Archiver'}
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

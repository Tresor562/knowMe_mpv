'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Archive = { conversationId: string; archivedAt: string };
type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{ userId: string; user: { displayName: string } }>;
};

type GroupKey = 'recent' | 'week' | 'older';

const GROUP_COPY: Record<GroupKey, string> = {
  recent: 'Dernières 24 heures',
  week: '7 derniers jours',
  older: 'Plus ancien'
};

export default function ConversationArchiveTimelinePage() {
  const { user, loading } = useSession({ required: true });
  const [archives, setArchives] = useState<Archive[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    let active = true;
    Promise.all([
      apiFetch<{ items: Archive[] }>('/conversation-archives'),
      apiFetch<Conversation[]>('/conversations')
    ])
      .then(([archiveData, conversationData]) => {
        if (!active) return;
        setArchives(archiveData.items);
        setConversations(conversationData);
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

  const names = useMemo(
    () =>
      new Map(
        conversations.map((conversation) => {
          const peers = conversation.members.filter((member) => member.userId !== user?.id);
          const name =
            conversation.title ||
            peers.map((member) => member.user.displayName).join(', ') ||
            'Conversation';
          return [conversation.id, name] as const;
        })
      ),
    [conversations, user?.id]
  );

  const groups = useMemo(() => {
    const now = Date.now();
    const result: Record<GroupKey, Archive[]> = { recent: [], week: [], older: [] };
    for (const archive of archives) {
      const age = now - new Date(archive.archivedAt).getTime();
      if (age <= 24 * 60 * 60 * 1000) result.recent.push(archive);
      else if (age <= 7 * 24 * 60 * 60 * 1000) result.week.push(archive);
      else result.older.push(archive);
    }
    return result;
  }, [archives]);

  if (loading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{ maxWidth: 900, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--mint)' }}>ARCHIVES · TIMELINE PRIVÉE</small>
          <h1>Chronologie des archives</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>Les groupes sont calculés localement et ne modifient aucune archive.</p>
        </div>
        <Link href="/conversation-archives" className="btn">Archives</Link>
      </header>

      {error && <p role="alert" style={{ color: 'var(--orange)' }}>{error}</p>}
      {busy && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {(['recent', 'week', 'older'] as GroupKey[]).map((key) => (
        <section key={key} style={{ marginTop: 24 }}>
          <h2>{GROUP_COPY[key]} <small style={{ color: 'var(--muted)' }}>({groups[key].length})</small></h2>
          <div className="grid" style={{ gap: 10 }}>
            {groups[key].map((archive) => (
              <Link key={archive.conversationId} href={`/messages/${archive.conversationId}`} className="card" style={{ padding: 16, display: 'block' }}>
                <strong>{names.get(archive.conversationId) ?? 'Conversation'}</strong>
                <small style={{ display: 'block', color: 'var(--muted)', marginTop: 5 }}>
                  Archivée le {new Date(archive.archivedAt).toLocaleString('fr-FR')}
                </small>
              </Link>
            ))}
            {!groups[key].length && <p style={{ color: 'var(--muted)' }}>Aucune archive dans cette période.</p>}
          </div>
        </section>
      ))}
    </main>
  );
}

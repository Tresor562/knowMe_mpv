'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../../lib/api';
import { useSession } from '../../../../lib/use-session';

type Folder = { id: string; name: string; conversationIds: string[] };
type Draft = { conversationId: string; content: string; version: number; updatedAt: string };
type Archive = { conversationId: string; archivedAt: string };
type SavedMessage = {
  messageId: string;
  savedAt: string;
  message: { id: string; conversationId: string; content: string };
};
type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{ userId: string; user: { displayName: string; username: string } }>;
};

export default function ConversationOrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const { user, loading } = useSession({ required: true });
  const [folders, setFolders] = useState<Folder[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [archives, setArchives] = useState<Archive[]>([]);
  const [saved, setSaved] = useState<SavedMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !conversationId) return;
    let active = true;
    Promise.all([
      apiFetch<{ items: Folder[] }>('/conversation-folders'),
      apiFetch<{ items: Draft[] }>('/conversation-drafts'),
      apiFetch<{ items: Archive[] }>('/conversation-archives'),
      apiFetch<{ items: SavedMessage[] }>('/saved-messages?limit=100'),
      apiFetch<Conversation[]>('/conversations')
    ])
      .then(([folderData, draftData, archiveData, savedData, conversationData]) => {
        if (!active) return;
        setFolders(folderData.items);
        setDrafts(draftData.items);
        setArchives(archiveData.items);
        setSaved(savedData.items);
        setConversations(conversationData);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Organisation indisponible.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [conversationId, loading]);

  const conversation = conversations.find((item) => item.id === conversationId);
  const title = useMemo(() => {
    if (!conversation) return 'Conversation';
    const peers = conversation.members.filter((member) => member.userId !== user?.id);
    return conversation.title || peers.map((member) => member.user.displayName).join(', ') || 'Conversation';
  }, [conversation, user?.id]);

  const folder = folders.find((item) => item.conversationIds.includes(conversationId));
  const draft = drafts.find((item) => item.conversationId === conversationId);
  const archive = archives.find((item) => item.conversationId === conversationId);
  const savedInConversation = saved.filter((item) => item.message.conversationId === conversationId);

  if (loading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{ maxWidth: 900, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--mint)' }}>CONVERSATION · ORGANISATION PRIVÉE</small>
          <h1>{title}</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>Vue en lecture seule de tes outils personnels pour cette conversation.</p>
        </div>
        <Link href={`/messages/${conversationId}`} className="btn">Conversation</Link>
      </header>

      {error && <p role="alert" style={{ color: 'var(--orange)' }}>{error}</p>}
      {busy && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 20 }}>
        <article className="card" style={{ padding: 16 }}>
          <small style={{ color: 'var(--muted)' }}>DOSSIER</small>
          <h2>{folder ? `🗂️ ${folder.name}` : '🗂️ Aucun dossier'}</h2>
          <Link href="/conversation-folders" className="btn">Gérer les dossiers</Link>
        </article>

        <article className="card" style={{ padding: 16 }}>
          <small style={{ color: 'var(--muted)' }}>ARCHIVE</small>
          <h2>{archive ? '📦 Archivée' : '📬 Active'}</h2>
          {archive && <p style={{ color: 'var(--muted)' }}>Depuis {new Date(archive.archivedAt).toLocaleString('fr-FR')}</p>}
          <Link href="/conversation-archives" className="btn">Gérer les archives</Link>
        </article>

        <article className="card" style={{ padding: 16 }}>
          <small style={{ color: 'var(--muted)' }}>BROUILLON</small>
          <h2>{draft ? `📝 v${draft.version}` : '📝 Aucun brouillon'}</h2>
          {draft && (
            <p style={{ color: 'var(--muted)', overflowWrap: 'anywhere' }}>
              {draft.content.length > 140 ? `${draft.content.slice(0, 137)}…` : draft.content || 'Brouillon vide'}
            </p>
          )}
          <Link href="/drafts" className="btn">Voir les brouillons</Link>
        </article>

        <article className="card" style={{ padding: 16 }}>
          <small style={{ color: 'var(--muted)' }}>MESSAGES ENREGISTRÉS</small>
          <h2>🔖 {savedInConversation.length}</h2>
          <p style={{ color: 'var(--muted)' }}>Références personnelles encore accessibles dans cette conversation.</p>
          <Link href="/saved-messages" className="btn">Bibliothèque</Link>
        </article>
      </section>

      <p style={{ color: 'var(--muted)', marginTop: 18 }}>
        Cette page n'accorde aucun droit supplémentaire : chaque donnée affichée vient des API personnelles déjà autorisées.
      </p>
    </main>
  );
}

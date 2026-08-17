'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Folder = {
  id: string;
  name: string;
  conversationIds: string[];
};

type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{
    userId: string;
    user: { displayName: string; username: string };
  }>;
};

export default function ConversationFolderSearchPage() {
  const { user, loading } = useSession({ required: true });
  const [folders, setFolders] = useState<Folder[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    let active = true;
    setDataLoading(true);
    setError('');

    Promise.all([
      apiFetch<{ items: Folder[] }>('/conversation-folders'),
      apiFetch<Conversation[]>('/conversations')
    ])
      .then(([folderData, conversationData]) => {
        if (!active) return;
        setFolders(folderData.items);
        setConversations(conversationData);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loading]);

  const conversationNames = useMemo(() => {
    return new Map(
      conversations.map((conversation) => {
        const peers = conversation.members.filter((member) => member.userId !== user?.id);
        const name =
          conversation.title ||
          peers.map((member) => member.user.displayName).join(', ') ||
          'Conversation';
        return [conversation.id, name] as const;
      })
    );
  }, [conversations, user?.id]);

  const filteredFolders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return folders;

    return folders.filter((folder) => {
      if (folder.name.toLocaleLowerCase().includes(normalized)) return true;
      return folder.conversationIds.some((conversationId) =>
        conversationNames.get(conversationId)?.toLocaleLowerCase().includes(normalized)
      );
    });
  }, [conversationNames, folders, query]);

  if (loading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{ maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--mint)' }}>DOSSIERS · RECHERCHE LOCALE</small>
          <h1>Retrouver un dossier</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            Le terme saisi reste dans ce navigateur : il n'est ni envoyé à l'API ni enregistré.
          </p>
        </div>
        <Link className="btn" href="/conversation-folders">Gérer les dossiers</Link>
      </header>

      <section className="card" style={{ padding: 16, marginTop: 18 }}>
        <label htmlFor="folder-search" style={{ display: 'grid', gap: 8 }}>
          <span>Nom du dossier ou d'une conversation</span>
          <input
            id="folder-search"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex. famille, projet, Awa…"
            autoComplete="off"
          />
        </label>
        <small style={{ color: 'var(--muted)', display: 'block', marginTop: 10 }}>
          {filteredFolders.length} résultat(s) sur {folders.length} dossier(s).
        </small>
      </section>

      {error && <p role="alert" style={{ color: 'var(--orange)' }}>{error}</p>}
      {dataLoading && <p style={{ color: 'var(--muted)' }}>Chargement des dossiers…</p>}

      <section className="grid" style={{ gap: 14, marginTop: 18 }} aria-live="polite">
        {filteredFolders.map((folder) => (
          <article className="card" key={folder.id} style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>{folder.name}</h2>
            <small style={{ color: 'var(--muted)' }}>{folder.conversationIds.length} conversation(s)</small>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {folder.conversationIds.map((conversationId) => (
                <Link href={`/messages/${conversationId}`} key={conversationId}>
                  {conversationNames.get(conversationId) ?? 'Conversation'}
                </Link>
              ))}
              {!folder.conversationIds.length && (
                <small style={{ color: 'var(--muted)' }}>Ce dossier est vide.</small>
              )}
            </div>
          </article>
        ))}

        {!dataLoading && !filteredFolders.length && (
          <div className="card" style={{ padding: 22 }}>
            <h2>Aucun résultat</h2>
            <p style={{ color: 'var(--muted)' }}>
              Aucun dossier personnel accessible ne correspond à cette recherche locale.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

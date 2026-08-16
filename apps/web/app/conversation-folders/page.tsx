'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Folder = {
  id: string;
  name: string;
  position: number;
  conversationIds: string[];
};

type FolderList = { items: Folder[] };

type Conversation = {
  id: string;
  title?: string | null;
  isGroup: boolean;
  members: Array<{
    userId: string;
    user: { id: string; displayName: string; username: string };
  }>;
};

export default function ConversationFoldersPage() {
  const { user, loading } = useSession({ required: true });
  const [folders, setFolders] = useState<Folder[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setMessage('');
    try {
      const [folderData, conversationData] = await Promise.all([
        apiFetch<FolderList>('/conversation-folders'),
        apiFetch<Conversation[]>('/conversations')
      ]);
      setFolders(folderData.items);
      setConversations(conversationData);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.');
    }
  }, []);

  useEffect(() => {
    if (!loading) void load();
  }, [load, loading]);

  const conversationNames = useMemo(() => {
    const pairs = conversations.map((conversation) => {
      const peers = conversation.members.filter((member) => member.userId !== user?.id);
      const name = conversation.title || peers.map((member) => member.user.displayName).join(', ') || 'Conversation';
      return [conversation.id, name] as const;
    });
    return new Map(pairs);
  }, [conversations, user?.id]);

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    if (!name) return;
    setBusy(true);
    setMessage('');
    try {
      await apiFetch('/conversation-folders', {
        method: 'POST',
        body: JSON.stringify({ name, position: folders.length })
      });
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function assign(folderId: string, conversationId: string) {
    if (!conversationId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await apiFetch(
        `/conversation-folders/${encodeURIComponent(folderId)}/conversations/${encodeURIComponent(conversationId)}`,
        { method: 'PUT' }
      );
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Classement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function unassign(conversationId: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await apiFetch(`/conversation-folders/assignments/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE'
      });
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Retrait impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function removeFolder(folderId: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await apiFetch(`/conversation-folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{ maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--mint)' }}>MESSAGERIE · ORGANISATION PRIVÉE</small>
          <h1>Dossiers de conversations</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            Ton classement reste privé et ne change jamais les membres d'une conversation.
          </p>
        </div>
        <Link className="btn" href="/messages">Retour aux messages</Link>
      </header>

      <form className="card" onSubmit={createFolder} style={{ padding: 16, marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="input" name="name" maxLength={40} required placeholder="Nouveau dossier" style={{ flex: 1, minWidth: 220 }} />
        <button className="btn btn-primary" disabled={busy}>Créer</button>
      </form>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section className="grid" style={{ gap: 14, marginTop: 18 }}>
        {folders.map((folder) => (
          <article className="card" key={folder.id} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>{folder.name}</h2>
                <small style={{ color: 'var(--muted)' }}>{folder.conversationIds.length} conversation(s)</small>
              </div>
              <button className="btn" disabled={busy} onClick={() => void removeFolder(folder.id)}>
                Supprimer le dossier
              </button>
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                className="input"
                defaultValue=""
                disabled={busy}
                onChange={(event) => {
                  const value = event.target.value;
                  event.target.value = '';
                  if (value) void assign(folder.id, value);
                }}
              >
                <option value="">Ajouter ou déplacer une conversation…</option>
                {conversations.map((conversation) => (
                  <option value={conversation.id} key={conversation.id}>
                    {conversationNames.get(conversation.id)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              {folder.conversationIds.map((conversationId) => (
                <div key={conversationId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <Link href={`/messages/${conversationId}`}>
                    {conversationNames.get(conversationId) ?? 'Conversation'}
                  </Link>
                  <button className="btn" disabled={busy} onClick={() => void unassign(conversationId)}>
                    Retirer
                  </button>
                </div>
              ))}
              {!folder.conversationIds.length && (
                <small style={{ color: 'var(--muted)' }}>Ce dossier est vide.</small>
              )}
            </div>
          </article>
        ))}
        {!folders.length && (
          <div className="card" style={{ padding: 22 }}>
            <h2>Aucun dossier</h2>
            <p style={{ color: 'var(--muted)' }}>Crée ton premier dossier pour organiser tes conversations sans affecter les autres membres.</p>
          </div>
        )}
      </section>
    </main>
  );
}

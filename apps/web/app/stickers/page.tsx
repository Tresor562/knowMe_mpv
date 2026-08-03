'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Sticker = {
  key: string;
  version: number;
  name: string;
  emoji: string;
  altText: string;
  assetToken: string;
  active: boolean;
};

type StickerPack = {
  key: string;
  version: number;
  name: string;
  description: string;
  coverEmoji: string;
  free: true;
  active: boolean;
  stickers: Sticker[];
};

type StickerCatalog = {
  schemaVersion: 1;
  packs: StickerPack[];
  policy: {
    freeStarterLibrary: true;
    signedMessagesRequired: true;
    arbitraryAssetsAllowed: false;
    arbitraryHtmlAllowed: false;
    visualOnly: true;
  };
};

type Conversation = {
  id: string;
  title?: string | null;
  members?: Array<{
    user?: { id: string; displayName: string; username: string };
  }>;
};

type StickerTokenResponse = {
  token: string;
  contentType: string;
  visualOnly: true;
  clientAssetAccepted: false;
};

function conversationLabel(conversation: Conversation) {
  const title = conversation.title?.trim();
  if (title) return title;
  const names = conversation.members
    ?.map((member) => member.user?.displayName)
    .filter(Boolean)
    .join(', ');
  return names || `Conversation ${conversation.id.slice(0, 8)}`;
}

async function mintStickerToken(input: {
  packKey: string;
  stickerKey: string;
  conversationId: string;
}) {
  const response = await fetch('/api/stickers/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  const data = (await response.json()) as StickerTokenResponse | { message?: string };
  if (!response.ok || !('token' in data)) {
    throw new Error('message' in data && data.message ? data.message : 'Signature impossible.');
  }
  return data;
}

export default function StickersPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [catalog, setCatalog] = useState<StickerCatalog | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState('');
  const [activePackKey, setActivePackKey] = useState('');
  const [busySticker, setBusySticker] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [catalogResponse, conversationResponse] = await Promise.all([
        fetch('/api/stickers/catalog', { cache: 'no-store' }),
        apiFetch<Conversation[]>('/conversations')
      ]);
      if (!catalogResponse.ok) throw new Error('Catalogue de stickers indisponible.');
      const nextCatalog = (await catalogResponse.json()) as StickerCatalog;
      setCatalog(nextCatalog);
      setConversations(conversationResponse);
      setConversationId((current) =>
        current && conversationResponse.some((entry) => entry.id === current)
          ? current
          : conversationResponse[0]?.id ?? ''
      );
      setActivePackKey((current) =>
        current && nextCatalog.packs.some((pack) => pack.key === current)
          ? current
          : nextCatalog.packs[0]?.key ?? ''
      );
      setStatus('');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const activePack = useMemo(
    () => catalog?.packs.find((pack) => pack.key === activePackKey) ?? null,
    [activePackKey, catalog]
  );

  async function send(pack: StickerPack, sticker: Sticker) {
    if (!conversationId || busySticker) return;
    const key = `${pack.key}:${sticker.key}`;
    setBusySticker(key);
    setStatus('');
    try {
      const signed = await mintStickerToken({
        packKey: pack.key,
        stickerKey: sticker.key,
        conversationId
      });
      await apiFetch(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: signed.token })
      });
      setStatus(`${sticker.emoji} ${sticker.name} envoyé.`);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Envoi impossible.');
    } finally {
      setBusySticker('');
    }
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement des stickers…</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>KMD-036 · STICKERS SIGNÉS</small>
        <h1>Une bibliothèque originale pour tes conversations</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 820 }}>
          KnowMe signe uniquement les stickers actifs de son catalogue. Aucun lien externe, HTML ou
          asset fourni par le navigateur ne peut devenir un sticker reconnu.
        </p>
      </header>

      {status ? <p role="status" className="card" style={{ padding: 14 }}>{status}</p> : null}

      {loading || !catalog ? (
        <p>Chargement du catalogue et des conversations…</p>
      ) : (
        <>
          <section className="card" style={{ padding: 20, marginTop: 22 }}>
            <label style={{ display: 'grid', gap: 8 }}>
              Conversation destinataire
              <select
                className="input"
                value={conversationId}
                onChange={(event) => setConversationId(event.target.value)}
              >
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversationLabel(conversation)}
                  </option>
                ))}
              </select>
            </label>
            {conversations.length === 0 ? (
              <div style={{ marginTop: 14 }}>
                <p style={{ color: 'var(--muted)' }}>
                  Crée d’abord une conversation pour envoyer un sticker.
                </p>
                <Link className="btn" href="/messages">Ouvrir la messagerie</Link>
              </div>
            ) : null}
          </section>

          <nav
            aria-label="Packs de stickers"
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '22px 0' }}
          >
            {catalog.packs.map((pack) => (
              <button
                key={pack.key}
                className={pack.key === activePackKey ? 'btn btn-primary' : 'btn'}
                onClick={() => setActivePackKey(pack.key)}
              >
                {pack.coverEmoji} {pack.name}
              </button>
            ))}
          </nav>

          {activePack ? (
            <section>
              <h2>{activePack.coverEmoji} {activePack.name}</h2>
              <p style={{ color: 'var(--muted)' }}>{activePack.description}</p>
              <div
                className="grid"
                style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}
              >
                {activePack.stickers.map((sticker) => {
                  const key = `${activePack.key}:${sticker.key}`;
                  return (
                    <button
                      key={sticker.key}
                      className="card"
                      disabled={!conversationId || Boolean(busySticker)}
                      onClick={() => void send(activePack, sticker)}
                      aria-label={`Envoyer ${sticker.altText}`}
                      style={{
                        padding: 18,
                        cursor: conversationId ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                        display: 'grid',
                        gap: 10
                      }}
                    >
                      <span style={{ fontSize: 54 }} aria-hidden="true">{sticker.emoji}</span>
                      <strong>{sticker.name}</strong>
                      <small style={{ color: 'var(--muted)' }}>
                        {busySticker === key ? 'Signature et envoi…' : sticker.altText}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="card" style={{ padding: 20, marginTop: 28 }}>
            <h2 style={{ marginTop: 0 }}>Garanties du protocole</h2>
            <p style={{ color: 'var(--muted)' }}>
              Les packs de démarrage sont gratuits, visuels et non transférables. La signature lie le
              sticker à sa version et à la conversation. Le système anti-spam de la messagerie reste
              responsable des limites d’envoi.
            </p>
          </section>
        </>
      )}
    </main>
  );
}

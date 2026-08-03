'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

type Sticker = {
  key: string;
  version: number;
  label: string;
  glyph: string;
  accessibilityLabel: string;
};

type Pack = {
  key: string;
  version: number;
  name: string;
  description: string;
  stickers: Sticker[];
};

type Catalog = {
  schemaVersion: 1;
  packs: Pack[];
  visualOnly: true;
  externalAssetAllowed: false;
  arbitraryHtmlAllowed: false;
  clientAssetAccepted: false;
};

export function StickerPicker<T>({
  conversationId,
  onSent
}: {
  conversationId: string;
  onSent: (message: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || catalog || loading) return;
    setLoading(true);
    void apiFetch<Catalog>('/stickers/catalog')
      .then((value) => {
        setCatalog(value);
        setError('');
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Catalogue indisponible.');
      })
      .finally(() => setLoading(false));
  }, [catalog, loading, open]);

  async function send(packKey: string, sticker: Sticker) {
    const operation = `${packKey}:${sticker.key}`;
    if (sending) return;
    setSending(operation);
    try {
      const message = await apiFetch<T>(
        `/conversations/${conversationId}/stickers`,
        {
          method: 'POST',
          body: JSON.stringify({ packKey, stickerKey: sticker.key })
        }
      );
      onSent(message);
      setError('');
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Envoi impossible.');
    } finally {
      setSending(null);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn"
        aria-expanded={open}
        aria-controls="knowme-sticker-picker"
        onClick={() => setOpen((value) => !value)}
      >
        Stickers
      </button>
      {open && (
        <section
          id="knowme-sticker-picker"
          className="card"
          aria-label="Bibliothèque de stickers KnowMe"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 'calc(100% + 10px)',
            width: 'min(430px, 88vw)',
            maxHeight: 420,
            overflow: 'auto',
            padding: 16,
            zIndex: 20,
            boxShadow: '0 20px 70px rgba(0,0,0,.45)'
          }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <strong>Stickers KnowMe</strong>
              <p style={{ color: 'var(--muted)', margin: '4px 0 12px' }}>
                Catalogue original fermé. Aucun fichier externe n’est accepté.
              </p>
            </div>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Fermer
            </button>
          </header>
          {loading && <p>Chargement…</p>}
          {error && <p role="alert" style={{ color: 'var(--orange)' }}>{error}</p>}
          {catalog?.packs.map((pack) => (
            <div key={`${pack.key}:${pack.version}`} style={{ marginTop: 14 }}>
              <strong>{pack.name}</strong>
              <small style={{ display: 'block', color: 'var(--muted)', marginBottom: 8 }}>
                {pack.description}
              </small>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(82px,1fr))', gap: 8 }}>
                {pack.stickers.map((sticker) => {
                  const operation = `${pack.key}:${sticker.key}`;
                  return (
                    <button
                      key={`${sticker.key}:${sticker.version}`}
                      type="button"
                      className="btn"
                      title={sticker.accessibilityLabel}
                      aria-label={`Envoyer le sticker ${sticker.label}`}
                      disabled={Boolean(sending)}
                      onClick={() => void send(pack.key, sticker)}
                      style={{ minHeight: 76, display: 'grid', placeItems: 'center', gap: 2 }}
                    >
                      <span aria-hidden="true" style={{ fontSize: 30 }}>{sticker.glyph}</span>
                      <small>{sending === operation ? 'Envoi…' : sticker.label}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

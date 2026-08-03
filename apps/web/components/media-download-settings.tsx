'use client';

import {
  MEDIA_KINDS,
  normalizeMediaDownloadPreference,
  type MediaDownloadPreference,
  type MediaKind
} from '@knowme/media-cache-contract';
import { useEffect, useState } from 'react';
import { apiFetch, type ApiError } from '../lib/api';
import { clearMediaCache, mediaCacheStats } from '../lib/media-cache';

type ServerPreference = MediaDownloadPreference & {
  version: number;
  persisted: boolean;
  updatedAt: string | null;
};

const LABELS: Record<MediaKind, string> = {
  IMAGE: 'Photos',
  VIDEO: 'Vidéos',
  AUDIO: 'Audio',
  FILE: 'Fichiers'
};

export function MediaDownloadSettings() {
  const [preference, setPreference] = useState<ServerPreference | null>(null);
  const [bytes, setBytes] = useState(0);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const [server, stats] = await Promise.all([
      apiFetch<ServerPreference>('/media/download-preferences'),
      mediaCacheStats().catch(() => ({ bytes: 0, count: 0, entries: [] }))
    ]);
    setPreference(server);
    setBytes(stats.bytes);
    setCount(stats.count);
  }

  useEffect(() => {
    void refresh().catch((cause) => setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.'));
  }, []);

  async function save(next: MediaDownloadPreference) {
    if (!preference || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const saved = await apiFetch<ServerPreference>('/media/download-preferences', {
        method: 'PUT',
        body: JSON.stringify({ ...normalizeMediaDownloadPreference(next), expectedVersion: preference.version })
      });
      setPreference(saved);
      setMessage('Préférences de téléchargement synchronisées.');
    } catch (cause) {
      if ((cause as ApiError)?.code === 'MEDIA_DOWNLOAD_VERSION_CONFLICT') {
        await refresh().catch(() => undefined);
      }
      setMessage(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  function toggle(network: 'wifiKinds' | 'cellularKinds' | 'roamingKinds', kind: MediaKind) {
    if (!preference) return;
    const current = preference[network];
    const next = current.includes(kind)
      ? current.filter((item) => item !== kind)
      : MEDIA_KINDS.filter((item) => [...current, kind].includes(item));
    void save({ ...preference, [network]: next });
  }

  async function clear() {
    setBusy(true);
    try {
      await clearMediaCache();
      setBytes(0);
      setCount(0);
      setMessage('Les copies locales ont été supprimées.');
    } finally {
      setBusy(false);
    }
  }

  if (!preference) return <section className="card" style={{ padding: 24 }}><p>Chargement des téléchargements…</p></section>;

  return (
    <section className="card" style={{ padding: 24, marginBottom: 20 }}>
      <h2>Téléchargements et cache média</h2>
      <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        Les aperçus restent disponibles. Une copie complète n’est créée que lorsque le réseau, le type de média et le quota l’autorisent.
      </p>
      {(['wifiKinds', 'cellularKinds', 'roamingKinds'] as const).map((network) => (
        <fieldset key={network} disabled={busy} style={{ border: 0, padding: 0, margin: '18px 0' }}>
          <legend style={{ fontWeight: 800, marginBottom: 10 }}>
            {network === 'wifiKinds' ? 'Wi‑Fi' : network === 'cellularKinds' ? 'Données mobiles' : 'Itinérance'}
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {MEDIA_KINDS.map((kind) => (
              <label key={kind} className="btn" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={preference[network].includes(kind)} onChange={() => toggle(network, kind)} />{' '}
                {LABELS[kind]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <label style={{ display: 'flex', gap: 10, margin: '12px 0' }}>
        <input
          type="checkbox"
          checked={preference.backgroundDownloads}
          disabled={busy}
          onChange={(event) => void save({ ...preference, backgroundDownloads: event.target.checked })}
        />
        Autoriser les téléchargements en arrière-plan
      </label>
      <label style={{ display: 'flex', gap: 10, margin: '12px 0' }}>
        <input
          type="checkbox"
          checked={preference.respectDataSaver}
          disabled={busy}
          onChange={(event) => void save({ ...preference, respectDataSaver: event.target.checked })}
        />
        Respecter l’économie de données de l’appareil
      </label>
      <label style={{ display: 'grid', gap: 8, maxWidth: 340 }}>
        Quota local : {preference.maxCacheMb} Mo
        <input
          type="range"
          min={64}
          max={4096}
          step={64}
          value={preference.maxCacheMb}
          disabled={busy}
          onChange={(event) => setPreference({ ...preference, maxCacheMb: Number(event.target.value) })}
          onPointerUp={() => void save(preference)}
        />
      </label>
      <p style={{ color: 'var(--muted)' }}>
        {count} copie{count === 1 ? '' : 's'} locale{count === 1 ? '' : 's'} · {(bytes / 1024 / 1024).toFixed(1)} Mo
      </p>
      <button className="btn" disabled={busy || count === 0} onClick={() => void clear()}>
        Supprimer toutes les copies locales
      </button>
      {message && <p role="status" style={{ color: 'var(--orange)' }}>{message}</p>}
    </section>
  );
}

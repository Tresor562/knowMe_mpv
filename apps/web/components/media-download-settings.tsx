'use client';

import {
  MEDIA_KINDS,
  normalizeMediaDownloadPreference,
  type MediaDownloadPreference,
  type MediaKind
} from '@knowme/media-cache-contract';
import { useEffect, useState } from 'react';
import { useI18n } from './i18n-provider';
import { apiFetch, type ApiError } from '../lib/api';
import { clearMediaCache, mediaCacheStats } from '../lib/media-cache';
import { KnowMeAnimatedIcon } from './knowme-animated-icon';
import { KnowMeGlyph, type KnowMeGlyphName } from './knowme-glyph';
import './media-download-vector.css';

type ServerPreference = MediaDownloadPreference & {
  version: number;
  persisted: boolean;
  updatedAt: string | null;
};

const MEDIA_GLYPHS: Record<MediaKind, KnowMeGlyphName> = {
  IMAGE: 'image', VIDEO: 'video', AUDIO: 'headphones', FILE: 'file'
};
const NETWORK_GLYPHS: Record<'wifiKinds' | 'cellularKinds' | 'roamingKinds', KnowMeGlyphName> = {
  wifiKinds: 'wifi', cellularKinds: 'phone', roamingKinds: 'map-pin'
};
const LABELS: Record<'fr' | 'en', Record<MediaKind, string>> = {
  fr: { IMAGE: 'Photos', VIDEO: 'Vidéos', AUDIO: 'Audio', FILE: 'Fichiers' },
  en: { IMAGE: 'Photos', VIDEO: 'Videos', AUDIO: 'Audio', FILE: 'Files' }
};

export function MediaDownloadSettings() {
  const { locale } = useI18n();
  const en = locale === 'en';
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
      setMessage(en ? 'Download preferences synced.' : 'Préférences de téléchargement synchronisées.');
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
      setMessage(en ? 'Local copies removed.' : 'Les copies locales ont été supprimées.');
    } finally {
      setBusy(false);
    }
  }

  if (!preference) return <p className="km-settings-hint km-media-vector-loading" role="status">
    <KnowMeAnimatedIcon name="refresh" size={18} state="loading"/>
    {en ? 'Loading download settings…' : 'Chargement des téléchargements…'}
  </p>;

  const networks = [
    ['wifiKinds', 'Wi-Fi'],
    ['cellularKinds', en ? 'Mobile data' : 'Données mobiles'],
    ['roamingKinds', en ? 'Roaming' : 'Itinérance']
  ] as const;

  return (
    <details className="km-settings-disclosure">
      <summary>
        <span className="km-media-vector-summary">
          <KnowMeGlyph name="download" size={20}/>
          {en ? 'Media & downloads' : 'Médias et téléchargements'}
        </span>
        <small>{en ? 'Network, storage and cache' : 'Réseau, stockage et cache'}</small>
      </summary>
      <div className="km-settings-disclosure-body">
        {networks.map(([network, heading]) => (
          <fieldset key={network} disabled={busy} className="km-settings-network">
            <legend className="km-media-vector-network">
              <KnowMeGlyph name={NETWORK_GLYPHS[network]} size={17}/>
              {heading}
            </legend>
            <div className="km-settings-chips">
              {MEDIA_KINDS.map(kind => (
                <label key={kind} className="km-settings-chip">
                  <input type="checkbox" checked={preference[network].includes(kind)}
                    onChange={() => toggle(network, kind)} />
                  <KnowMeGlyph name={MEDIA_GLYPHS[kind]} size={16}/>
                  {LABELS[en ? 'en' : 'fr'][kind]}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <label className="km-settings-toggle"><input type="checkbox" checked={preference.backgroundDownloads}
          disabled={busy} onChange={event => void save({ ...preference, backgroundDownloads: event.target.checked })} />
          {en ? 'Allow background downloads' : 'Autoriser les téléchargements en arrière-plan'}
        </label>
        <label className="km-settings-toggle"><input type="checkbox" checked={preference.respectDataSaver}
          disabled={busy} onChange={event => void save({ ...preference, respectDataSaver: event.target.checked })} />
          {en ? 'Respect device data saver' : 'Respecter l’économie de données'}
        </label>
        <label className="km-settings-quota">{en ? 'Local cache limit' : 'Limite de cache local'} : {preference.maxCacheMb} MB
          <input type="range" min={64} max={4096} step={64} value={preference.maxCacheMb}
            disabled={busy} onChange={event => setPreference({ ...preference, maxCacheMb: Number(event.target.value) })}
            onPointerUp={() => void save(preference)} />
        </label>
        <p className="km-settings-hint">{count} {en ? 'local copies' : 'copies locales'} · {(bytes / 1024 / 1024).toFixed(1)} MB</p>
        <button type="button" className="km-settings-link-button" disabled={busy || count === 0}
          onClick={() => void clear()}>
          <KnowMeAnimatedIcon name={busy ? 'refresh' : 'trash'}
            state={busy ? 'loading' : 'idle'} size={18}/>
          {en ? 'Clear local copies' : 'Supprimer les copies locales'}
        </button>
        {message && <p role="status" className="km-settings-hint">{message}</p>}
      </div>
    </details>
  );
}

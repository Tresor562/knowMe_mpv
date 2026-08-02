'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Character = {
  id: string;
  key: string;
  version: number;
  displayName: string;
  description: string;
  originalWork: boolean;
  licenseKey: string;
  assets: Array<{
    id: string;
    eventKey: string;
    variant: string;
    platform: string;
    deviceClass: string;
  }>;
};

type Resolution = {
  deliveryVariant: string;
  asset: null | {
    key: string;
    version: number;
    publicUrl: string;
    sha256: string;
    bytes: number;
    mimeType: string;
    durationMs: number;
    integrityAlgorithm: string;
    character: {
      displayName: string;
      originalWork: boolean;
      licenseKey: string;
    };
  };
  fallback: null | { symbol: string; label: string; reason: string };
  rules: {
    lazyDelivery: boolean;
    integrityRequired: boolean;
    maximumAssetBytes: number;
    paidPriorityAllowed: boolean;
  };
};

export default function ConceptKCharactersPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [characters, setCharacters] = useState<Character[]>([]);
  const [eventKey, setEventKey] = useState('LEVEL_UP');
  const [platform, setPlatform] = useState('WEB');
  const [deviceClass, setDeviceClass] = useState('MID');
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ items: Character[] }>('/concept-k/characters');
      setCharacters(response.items);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Catalogue indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function resolve(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await apiFetch<Resolution>('/concept-k/assets/resolve', {
        method: 'POST',
        body: JSON.stringify({
          eventKey,
          platform,
          deviceClass,
          clientReducedMotion:
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
        })
      });
      setResolution(result);
      setMessage('Manifeste résolu côté serveur.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Résolution impossible.');
    }
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement du catalogue Concept K…</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 980, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>PERSONNAGES CONCEPT K</small>
        <h1>Catalogue original et assets vérifiables</h1>
        <p style={{ color: 'var(--muted)' }}>
          Les assets sont choisis côté serveur selon la plateforme, l’appareil, l’accessibilité et
          le rollout. Aucun abonnement ne donne une priorité de téléchargement.
        </p>
      </header>

      {message && <p role="status">{message}</p>}

      <section style={{ display: 'grid', gap: 14 }}>
        {characters.length === 0 && (
          <div className="card" style={{ padding: 20 }}>
            Aucun personnage actif. Les fallbacks statiques restent disponibles.
          </div>
        )}
        {characters.map((character) => (
          <article className="card" style={{ padding: 20 }} key={character.id}>
            <h2>{character.displayName} <small>v{character.version}</small></h2>
            <p>{character.description}</p>
            <p style={{ color: 'var(--muted)' }}>
              Œuvre originale : {character.originalWork ? 'oui' : 'non'} · Licence : {character.licenseKey}
            </p>
            <p>{character.assets.length} manifeste(s) actif(s)</p>
          </article>
        ))}
      </section>

      <form className="card" style={{ padding: 22, marginTop: 24, display: 'grid', gap: 12 }} onSubmit={resolve}>
        <h2>Inspecter une résolution</h2>
        <label>Événement<input value={eventKey} onChange={(event) => setEventKey(event.target.value)} /></label>
        <label>
          Plateforme
          <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
            <option value="WEB">Web</option>
            <option value="IOS">iOS</option>
            <option value="ANDROID">Android</option>
          </select>
        </label>
        <label>
          Classe d’appareil
          <select value={deviceClass} onChange={(event) => setDeviceClass(event.target.value)}>
            <option value="LOW">Modeste</option>
            <option value="MID">Intermédiaire</option>
            <option value="HIGH">Puissant</option>
            <option value="UNKNOWN">Inconnue</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit">Résoudre le manifeste</button>
      </form>

      {resolution && (
        <section className="card" style={{ padding: 22, marginTop: 20 }}>
          <h2>Résultat : {resolution.deliveryVariant}</h2>
          {resolution.asset ? (
            <>
              <p><strong>Personnage :</strong> {resolution.asset.character.displayName}</p>
              <p><strong>Asset :</strong> {resolution.asset.key} v{resolution.asset.version}</p>
              <p><strong>Intégrité :</strong> {resolution.asset.integrityAlgorithm} · <code>{resolution.asset.sha256}</code></p>
              <p><strong>Poids :</strong> {resolution.asset.bytes} octets · <strong>Durée :</strong> {resolution.asset.durationMs} ms</p>
              <p><strong>URL manifeste :</strong> <code>{resolution.asset.publicUrl}</code></p>
            </>
          ) : (
            <p style={{ fontSize: 28 }}>
              {resolution.fallback?.symbol} {resolution.fallback?.label} — {resolution.fallback?.reason}
            </p>
          )}
          <p style={{ color: 'var(--muted)' }}>
            Chargement différé : oui · Intégrité requise : oui · Priorité payante : non.
          </p>
        </section>
      )}
    </main>
  );
}

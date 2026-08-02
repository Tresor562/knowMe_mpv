'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type PublicItem = {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string | null;
  rarity: string;
  assetUrl: string;
  previewUrl: string | null;
};

type PublicSlot = {
  slot: string;
  item: PublicItem | null;
  fallback: boolean;
  fallbackReason: string | null;
};

type PublicCosmetics = {
  profile: {
    accountId?: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  visible: boolean;
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
  viewerContext?: 'OWNER' | 'FRIEND' | 'PUBLIC';
  slots: PublicSlot[];
  rules: {
    serverResolved: boolean;
    visualOnly: boolean;
    acquisitionSourceExposed: boolean;
    purchasePriceExposed: boolean;
    inactiveAssetsFallbackSafely: boolean;
    gameplayEffectsAllowed: boolean;
    paidPriorityAllowed: boolean;
  };
};

const SLOT_LABELS: Record<string, string> = {
  AVATAR_FRAME: 'Cadre d’avatar',
  PROFILE_BACKGROUND: 'Fond de profil',
  CHAT_BUBBLE: 'Bulle de discussion',
  PROFILE_BADGE: 'Accent de badge'
};

export default function PublicCosmeticProfilePage() {
  const params = useParams<{ username: string }>();
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [snapshot, setSnapshot] = useState<PublicCosmetics | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const username = decodeURIComponent(params.username);
      setSnapshot(
        await apiFetch<PublicCosmetics>(`/cosmetics/public/${encodeURIComponent(username)}`)
      );
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Profil cosmétique indisponible.');
    }
  }, [params.username]);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  if (sessionLoading || !user || !snapshot) {
    return <main className="shell"><p>{message || 'Chargement du profil cosmétique…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 920, margin: '0 auto' }}>
      <section className="card" style={{ padding: 26 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,var(--mint),var(--orange))',
              display: 'grid',
              placeItems: 'center',
              fontSize: 34,
              fontWeight: 900
            }}
          >
            {snapshot.profile.displayName[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <small style={{ color: 'var(--mint)' }}>PROFIL COSMÉTIQUE KNOWME</small>
            <h1 style={{ marginBottom: 4 }}>{snapshot.profile.displayName}</h1>
            <p style={{ color: 'var(--muted)' }}>@{snapshot.profile.username}</p>
            {snapshot.viewerContext && (
              <small>Vue : {snapshot.viewerContext} · Audience effective : {snapshot.visibility}</small>
            )}
          </div>
          {snapshot.viewerContext === 'OWNER' && (
            <a className="btn" href="/privacy/cosmetics">Régler la confidentialité</a>
          )}
        </div>
      </section>

      {!snapshot.visible ? (
        <section className="card" style={{ padding: 24, marginTop: 22 }}>
          <h2>Personnalisation non visible</h2>
          <p style={{ color: 'var(--muted)' }}>
            Ce membre limite ses objets équipés à une audience plus restreinte.
          </p>
        </section>
      ) : (
        <section style={{ display: 'grid', gap: 16, marginTop: 22 }}>
          {snapshot.slots.length === 0 && (
            <article className="card" style={{ padding: 22 }}>
              Aucun objet cosmétique visible n’est équipé.
            </article>
          )}
          {snapshot.slots.map((entry) => (
            <article className="card" style={{ padding: 22 }} key={entry.slot}>
              <small style={{ color: 'var(--mint)' }}>{SLOT_LABELS[entry.slot] ?? entry.slot}</small>
              {entry.item ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <h2>{entry.item.name}</h2>
                    <p style={{ color: 'var(--muted)' }}>
                      {entry.item.description ?? 'Objet cosmétique purement visuel.'}
                    </p>
                    <small>{entry.item.rarity} · Version {entry.item.version}</small>
                  </div>
                  {entry.item.previewUrl && (
                    <img
                      src={entry.item.previewUrl}
                      alt={`Aperçu de ${entry.item.name}`}
                      width={96}
                      height={96}
                      style={{ borderRadius: 14, objectFit: 'cover' }}
                    />
                  )}
                </div>
              ) : (
                <div>
                  <h2>Fallback sécurisé</h2>
                  <p style={{ color: 'var(--muted)' }}>
                    L’asset équipé est retiré ou indisponible. Aucun fichier obsolète n’est envoyé au client.
                  </p>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      <section className="card" style={{ padding: 22, marginTop: 22 }}>
        <h2>Garanties du rendu</h2>
        <p style={{ color: 'var(--muted)' }}>
          Résolution serveur : <strong>{snapshot.rules.serverResolved ? 'oui' : 'non'}</strong> ·
          Visuel uniquement : <strong>{snapshot.rules.visualOnly ? 'oui' : 'non'}</strong> ·
          Source d’acquisition exposée : <strong>{snapshot.rules.acquisitionSourceExposed ? 'oui' : 'non'}</strong> ·
          Prix exposé : <strong>{snapshot.rules.purchasePriceExposed ? 'oui' : 'non'}</strong> ·
          Effets de jeu : <strong>{snapshot.rules.gameplayEffectsAllowed ? 'autorisés' : 'interdits'}</strong>
        </p>
      </section>
    </main>
  );
}

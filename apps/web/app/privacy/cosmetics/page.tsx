'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type CosmeticVisibility = 'FOLLOW_PROFILE' | 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
type Slot = 'AVATAR_FRAME' | 'PROFILE_BACKGROUND' | 'CHAT_BUBBLE' | 'PROFILE_BADGE';

type Preferences = {
  profileVisibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
  cosmeticVisibility: CosmeticVisibility;
  hiddenCosmeticSlots: Slot[];
  version: number;
};

type PrivacyCenter = {
  preferences: Preferences;
};

const SLOT_LABELS: Record<Slot, string> = {
  AVATAR_FRAME: 'Cadre d’avatar',
  PROFILE_BACKGROUND: 'Fond de profil',
  CHAT_BUBBLE: 'Bulle de discussion',
  PROFILE_BADGE: 'Accent de badge'
};

const SLOTS = Object.keys(SLOT_LABELS) as Slot[];

export default function CosmeticPrivacyPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const center = await apiFetch<PrivacyCenter>('/privacy/center?locale=fr');
      setPreferences(center.preferences);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Préférences indisponibles.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function update(patch: Partial<Preferences>) {
    setBusy(true);
    try {
      const result = await apiFetch<Preferences>('/privacy/preferences', {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      setPreferences(result);
      setMessage('Confidentialité cosmétique enregistrée sur le serveur.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Mise à jour impossible.');
    } finally {
      setBusy(false);
    }
  }

  function toggleSlot(slot: Slot, hidden: boolean) {
    if (!preferences) return;
    const next = hidden
      ? Array.from(new Set([...preferences.hiddenCosmeticSlots, slot]))
      : preferences.hiddenCosmeticSlots.filter((entry) => entry !== slot);
    void update({ hiddenCosmeticSlots: next });
  }

  if (sessionLoading || !user || !preferences) {
    return <main className="shell"><p>{message || 'Chargement de la confidentialité cosmétique…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 900, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>CONFIDENTIALITÉ COSMÉTIQUE</small>
        <h1>Choisis ce que ton profil affiche</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
          La visibilité cosmétique ne peut jamais dépasser celle de ton profil. Les slots masqués
          sont entièrement omis du snapshot public, sans révéler la source ou le prix des objets.
        </p>
      </header>

      {message && <p role="status" style={{ marginTop: 18 }}>{message}</p>}

      <section className="card" style={{ padding: 22, marginTop: 22 }}>
        <h2>Audience cosmétique</h2>
        <label style={{ display: 'grid', gap: 8 }}>
          Qui peut voir mes objets équipés ?
          <select
            value={preferences.cosmeticVisibility}
            disabled={busy}
            onChange={(event) =>
              void update({ cosmeticVisibility: event.target.value as CosmeticVisibility })
            }
          >
            <option value="FOLLOW_PROFILE">Suivre la visibilité du profil</option>
            <option value="PRIVATE">Moi uniquement</option>
            <option value="FRIENDS">Mes amis</option>
            <option value="PUBLIC">Public, si le profil est public</option>
          </select>
        </label>
        <p style={{ color: 'var(--muted)' }}>
          Visibilité actuelle du profil : <strong>{preferences.profileVisibility}</strong>. Même
          avec « Public », un profil privé garde les cosmétiques privés.
        </p>
      </section>

      <section className="card" style={{ padding: 22, marginTop: 22 }}>
        <h2>Slots visibles</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          {SLOTS.map((slot) => {
            const hidden = preferences.hiddenCosmeticSlots.includes(slot);
            return (
              <label key={slot} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={!hidden}
                  disabled={busy}
                  onChange={(event) => toggleSlot(slot, !event.target.checked)}
                />
                <span>
                  <strong>{SLOT_LABELS[slot]}</strong><br />
                  <small style={{ color: 'var(--muted)' }}>
                    {hidden ? 'Masqué dans tous les aperçus publics.' : 'Visible selon l’audience choisie.'}
                  </small>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="card" style={{ padding: 22, marginTop: 22 }}>
        <h2>Aperçu</h2>
        <p style={{ color: 'var(--muted)' }}>
          Le rendu est résolu par le serveur. Un asset retiré ou hors fenêtre est remplacé par un
          fallback sûr et aucune application cliente ne peut déclarer un objet non équipé.
        </p>
        <a className="btn btn-primary" href={`/profile/${user.username}`}>
          Voir mon profil cosmétique
        </a>
      </section>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Preference = {
  enabled: boolean;
  invitationsEnabled: boolean;
  membershipEnabled: boolean;
  governanceEnabled: boolean;
  contentEnabled: boolean;
  familyEnabled: boolean;
  realtimeEnabled: boolean;
  mutedCircleIds: string[];
};

type CircleEntry = {
  circle: {
    id: string;
    name: string;
    type: string;
    status: string;
  };
  membership: {
    role: string;
    status: string;
  };
};

const DEFAULT_PREFERENCE: Preference = {
  enabled: true,
  invitationsEnabled: true,
  membershipEnabled: true,
  governanceEnabled: true,
  contentEnabled: true,
  familyEnabled: true,
  realtimeEnabled: true,
  mutedCircleIds: []
};

export default function ProfileCircleNotificationSettingsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [preference, setPreference] = useState<Preference>(DEFAULT_PREFERENCE);
  const [circles, setCircles] = useState<CircleEntry[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [saved, entries] = await Promise.all([
        apiFetch<Preference>('/profile-circle-notification-preferences/me'),
        apiFetch<CircleEntry[]>('/profile-circles/me')
      ]);
      setPreference(saved);
      setCircles(entries);
      setMessage('');
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Préférences indisponibles.'
      );
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user]);

  function setBoolean(key: keyof Preference, value: boolean) {
    setPreference((current) => ({ ...current, [key]: value }));
  }

  function toggleMuted(circleId: string) {
    setPreference((current) => {
      const muted = new Set(current.mutedCircleIds);
      if (muted.has(circleId)) muted.delete(circleId);
      else muted.add(circleId);
      return { ...current, mutedCircleIds: [...muted] };
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await apiFetch<Preference>(
        '/profile-circle-notification-preferences/me',
        {
          method: 'PUT',
          body: JSON.stringify(preference)
        }
      );
      setPreference(saved);
      setMessage('Préférences de notifications enregistrées.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement des préférences…</p></main>;
  }

  return (
    <main
      className="shell"
      style={{ maxWidth: 880, margin: '0 auto', display: 'grid', gap: 20 }}
    >
      <section className="card" style={{ padding: 28 }}>
        <small style={{ color: 'var(--mint)' }}>NOTIFICATIONS COLLECTIVES</small>
        <h1>Choisir ce qui mérite ton attention</h1>
        <p style={{ color: 'var(--muted)' }}>
          Coupe les catégories facultatives, désactive le temps réel ou rends une
          structure silencieuse. Les changements importants de propriété, rôle,
          retrait et modération restent conservés dans la boîte.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn" href="/profile-circles">Mes relations</Link>
          <Link className="btn" href="/notifications">Ma boîte</Link>
          <Link className="btn" href="/profile">Mon profil</Link>
        </div>
      </section>

      <form className="card grid" style={{ padding: 24 }} onSubmit={save}>
        <Toggle
          label="Notifications collectives facultatives"
          description="Interrupteur général pour les catégories non obligatoires."
          checked={preference.enabled}
          onChange={(value) => setBoolean('enabled', value)}
        />
        <Toggle
          label="Invitations"
          description="Création de Duo, Équipe, Famille ou Guilde."
          checked={preference.invitationsEnabled}
          onChange={(value) => setBoolean('invitationsEnabled', value)}
        />
        <Toggle
          label="Membres et adhésions"
          description="Départs, demandes de guilde et décisions facultatives."
          checked={preference.membershipEnabled}
          onChange={(value) => setBoolean('membershipEnabled', value)}
        />
        <Toggle
          label="Évolution et gouvernance"
          description="Pause, reprise et autres changements non obligatoires."
          checked={preference.governanceEnabled}
          onChange={(value) => setBoolean('governanceEnabled', value)}
        />
        <Toggle
          label="Contenus"
          description="Activité de moments et Stories ; les verdicts personnels restent obligatoires."
          checked={preference.contentEnabled}
          onChange={(value) => setBoolean('contentEnabled', value)}
        />
        <Toggle
          label="Famille"
          description="Propositions et décisions relatives aux liens déclarés."
          checked={preference.familyEnabled}
          onChange={(value) => setBoolean('familyEnabled', value)}
        />
        <Toggle
          label="Affichage instantané"
          description="Désactive le WebSocket sans supprimer les notifications de la boîte."
          checked={preference.realtimeEnabled}
          onChange={(value) => setBoolean('realtimeEnabled', value)}
        />

        <button className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer les préférences'}
        </button>
        {message && <p role="status" style={{ color: 'var(--mint)' }}>{message}</p>}
      </form>

      <section className="card" style={{ padding: 24 }}>
        <h2>Structures silencieuses</h2>
        <p style={{ color: 'var(--muted)' }}>
          Les alertes facultatives de ces structures restent coupées. Les événements
          transactionnels importants restent disponibles dans la boîte.
        </p>
        {circles.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>Aucune structure à configurer.</p>
        )}
        <div className="grid">
          {circles.map((entry) => {
            const muted = preference.mutedCircleIds.includes(entry.circle.id);
            return (
              <button
                type="button"
                className="card"
                key={entry.circle.id}
                onClick={() => toggleMuted(entry.circle.id)}
                style={{
                  padding: 16,
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <span>
                  <strong>{entry.circle.name}</strong>
                  <span style={{ display: 'block', color: 'var(--muted)' }}>
                    {entry.circle.type} · {entry.membership.role}
                  </span>
                </span>
                <strong>{muted ? '🔕 Silencieuse' : '🔔 Active'}</strong>
              </button>
            );
          })}
        </div>
        <p style={{ color: 'var(--muted)' }}>
          Enregistre le formulaire principal après avoir modifié cette liste.
        </p>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <small style={{ color: 'var(--muted)' }}>
          Désactiver le temps réel ne supprime aucune notification. Les messages
          autorisés restent persistés et apparaissent au prochain chargement.
        </small>
      </section>
    </main>
  );
}

function Toggle(props: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className="card"
      style={{
        padding: 16,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        alignItems: 'center'
      }}
    >
      <span>
        <strong>{props.label}</strong>
        <span style={{ display: 'block', color: 'var(--muted)' }}>
          {props.description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  );
}

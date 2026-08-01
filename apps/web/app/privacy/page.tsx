'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Policy = {
  id: string;
  key: string;
  version: number;
  locale: string;
  title: string;
  summary: string;
  required: boolean;
  effectiveAt: string;
  granted: boolean;
  needsRenewal: boolean;
};

type Preferences = {
  profileVisibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
  discoverability: boolean;
  personalizedRecommendations: boolean;
  analytics: boolean;
  marketing: boolean;
  readReceipts: boolean;
  activityStatus: boolean;
  version: number;
};

type PrivacyRequest = {
  id: string;
  type: string;
  status: string;
  reason?: string | null;
  requestedAt: string;
  dueAt: string;
};

type PrivacyCenter = {
  policies: Policy[];
  preferences: Preferences;
  requests: PrivacyRequest[];
  consentHistory: Array<{
    id: string;
    policyKey: string;
    policyVersion: number;
    action: string;
    source: string;
    occurredAt: string;
  }>;
};

function idempotencyKey() {
  return `web-${Date.now()}-${crypto.randomUUID()}`;
}

export default function PrivacyPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [center, setCenter] = useState<PrivacyCenter | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCenter(await apiFetch<PrivacyCenter>('/privacy/center?locale=fr'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Centre de confidentialité indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function decide(policy: Policy, action: 'GRANT' | 'WITHDRAW') {
    setBusy(true);
    try {
      await apiFetch('/privacy/consents', {
        method: 'POST',
        body: JSON.stringify({
          policyKey: policy.key,
          policyVersion: policy.version,
          locale: policy.locale,
          action,
          source: 'WEB',
          idempotencyKey: idempotencyKey()
        })
      });
      await load();
      setMessage(action === 'GRANT' ? 'Consentement enregistré.' : 'Consentement retiré.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Décision impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function updatePreference(name: keyof Preferences, value: boolean | string) {
    setBusy(true);
    try {
      await apiFetch('/privacy/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ [name]: value })
      });
      await load();
      setMessage('Préférence enregistrée sur le serveur.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Mise à jour impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch('/privacy/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: String(form.get('type') ?? 'EXPORT'),
          reason: String(form.get('reason') ?? ''),
          idempotencyKey: idempotencyKey()
        })
      });
      event.currentTarget.reset();
      await load();
      setMessage('Demande enregistrée.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Demande impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/privacy/requests/${id}`, { method: 'DELETE' });
      await load();
      setMessage('Demande annulée.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Annulation impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || !center) {
    return <main className="shell"><p>Chargement de tes choix de confidentialité…</p></main>;
  }

  const toggles: Array<[keyof Preferences, string, string]> = [
    ['discoverability', 'Découverte du profil', 'Autoriser les autres membres à te trouver dans les suggestions.'],
    ['personalizedRecommendations', 'Recommandations personnalisées', 'Adapter défis, profils et contenus à ton activité.'],
    ['analytics', 'Mesure d’audience facultative', 'Partager des données d’usage minimisées pour améliorer KnowMe.'],
    ['marketing', 'Informations commerciales', 'Recevoir les offres et nouveautés commerciales de KnowMe.'],
    ['readReceipts', 'Accusés de lecture', 'Afficher aux contacts quand leurs messages ont été lus.'],
    ['activityStatus', 'Statut d’activité', 'Afficher ta présence aux personnes autorisées.']
  ];

  return (
    <main className="shell" style={{ maxWidth: 980, margin: '0 auto' }}>
      <header style={{ marginBottom: 28 }}>
        <small style={{ color: 'var(--mint)' }}>CONFIDENTIALITÉ KNOWME</small>
        <h1>Mes données, mes choix</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
          Les décisions de {user?.displayName} sont enregistrées par le serveur avec la version exacte de chaque politique. Une application modifiée ne peut pas fabriquer un consentement.
        </p>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section style={{ marginBottom: 34 }}>
        <h2>Politiques et consentements</h2>
        <div className="grid">
          {center.policies.map((policy) => (
            <article className="card" key={`${policy.key}-${policy.version}`} style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{policy.title}</strong>
                <span style={{ color: policy.granted ? 'var(--mint)' : 'var(--orange)' }}>
                  {policy.granted ? 'Acceptée' : policy.required ? 'Requise' : 'Facultative'}
                </span>
              </div>
              <p>{policy.summary}</p>
              <small style={{ color: 'var(--muted)' }}>
                Version {policy.version} · effective le {new Date(policy.effectiveAt).toLocaleDateString('fr-FR')}
              </small>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                {!policy.granted && (
                  <button className="btn" disabled={busy} onClick={() => void decide(policy, 'GRANT')}>
                    Accepter cette version
                  </button>
                )}
                {policy.granted && !policy.required && (
                  <button className="btn" disabled={busy} onClick={() => void decide(policy, 'WITHDRAW')}>
                    Retirer mon consentement
                  </button>
                )}
              </div>
            </article>
          ))}
          {!center.policies.length && <article className="card" style={{ padding: 22 }}>Aucune politique publiée.</article>}
        </div>
      </section>

      <section className="card" style={{ padding: 24, marginBottom: 34 }}>
        <h2>Préférences détaillées</h2>
        <label style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
          Visibilité du profil
          <select
            value={center.preferences.profileVisibility}
            disabled={busy}
            onChange={(event) => void updatePreference('profileVisibility', event.target.value)}
          >
            <option value="PRIVATE">Privé</option>
            <option value="FRIENDS">Amis</option>
            <option value="PUBLIC">Public</option>
          </select>
        </label>
        <div style={{ display: 'grid', gap: 16 }}>
          {toggles.map(([name, title, description]) => (
            <label key={name} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={Boolean(center.preferences[name])}
                disabled={busy}
                onChange={(event) => void updatePreference(name, event.target.checked)}
              />
              <span><strong>{title}</strong><br /><small style={{ color: 'var(--muted)' }}>{description}</small></span>
            </label>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 34 }}>
        <h2>Exercer mes droits</h2>
        <form className="card" onSubmit={createRequest} style={{ padding: 24, display: 'grid', gap: 14 }}>
          <select name="type" defaultValue="EXPORT">
            <option value="EXPORT">Recevoir une copie de mes données</option>
            <option value="CORRECT">Demander une correction</option>
            <option value="RESTRICT">Limiter un traitement</option>
            <option value="OBJECT">M’opposer à un traitement</option>
            <option value="DELETE">Demander la suppression</option>
          </select>
          <textarea name="reason" maxLength={1000} placeholder="Précision facultative" />
          <button className="btn" disabled={busy}>Créer la demande</button>
        </form>
        <div className="grid" style={{ marginTop: 18 }}>
          {center.requests.map((item) => (
            <article className="card" key={item.id} style={{ padding: 20 }}>
              <strong>{item.type}</strong>
              <p>Statut : {item.status}</p>
              <small style={{ color: 'var(--muted)' }}>
                Demandée le {new Date(item.requestedAt).toLocaleString('fr-FR')} · échéance {new Date(item.dueAt).toLocaleDateString('fr-FR')}
              </small>
              {item.status === 'PENDING' && (
                <button className="btn" disabled={busy} onClick={() => void cancelRequest(item.id)} style={{ marginTop: 14 }}>
                  Annuler
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Historique de consentement</h2>
        <div className="card" style={{ padding: 20 }}>
          {center.consentHistory.map((event) => (
            <p key={event.id}>
              <strong>{event.policyKey} v{event.policyVersion}</strong> · {event.action} · {new Date(event.occurredAt).toLocaleString('fr-FR')}
            </p>
          ))}
          {!center.consentHistory.length && <p>Aucune décision enregistrée.</p>}
        </div>
      </section>
    </main>
  );
}

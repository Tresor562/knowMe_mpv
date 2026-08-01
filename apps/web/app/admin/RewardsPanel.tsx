'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type RewardPolicy = {
  id: string;
  key: string;
  version: number;
  eventType: string;
  enabled: boolean;
  amount: number;
  dailyLimitPerUser: number;
  maxPerEntity: number;
  minQuestions: number;
  startsAt: string;
  endsAt: string | null;
  reason: string;
  createdAt: string;
};

type RewardEvent = {
  id: string;
  userId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  status: string;
  amount: number;
  reasonCode: string | null;
  explanation: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string;
  };
  policy: RewardPolicy;
};

export function RewardsPanel() {
  const [policies, setPolicies] = useState<RewardPolicy[]>([]);
  const [events, setEvents] = useState<RewardEvent[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [policyResult, eventResult] = await Promise.all([
        apiFetch<RewardPolicy[]>('/admin/rewards/policies'),
        apiFetch<RewardEvent[]>('/admin/rewards/events')
      ]);
      setPolicies(policyResult);
      setEvents(eventResult);
      setMessage('');
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger le moteur de récompenses.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const endsAt = String(data.get('endsAt') ?? '').trim();
    setBusy('create');

    try {
      await apiFetch('/admin/rewards/policies', {
        method: 'POST',
        body: JSON.stringify({
          key: String(data.get('key') ?? '').trim(),
          eventType: String(data.get('eventType') ?? '').trim(),
          amount: Number(data.get('amount')),
          dailyLimitPerUser: Number(data.get('dailyLimitPerUser')),
          maxPerEntity: Number(data.get('maxPerEntity')),
          minQuestions: Number(data.get('minQuestions')),
          reason: String(data.get('reason') ?? '').trim(),
          ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {})
        })
      });
      form.reset();
      setMessage('Nouvelle version de politique créée.');
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Impossible de créer cette politique.'
      );
    } finally {
      setBusy(null);
    }
  }

  async function toggle(policy: RewardPolicy) {
    const enabled = !policy.enabled;
    const action = enabled ? 'réactiver' : 'désactiver';
    const reason = window.prompt(
      `Motif obligatoire pour ${action} ${policy.key} v${policy.version} :`
    )?.trim();
    if (!reason) return;

    setBusy(policy.id);
    try {
      await apiFetch(`/admin/rewards/policies/${policy.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled, reason })
      });
      setMessage(`Politique ${enabled ? 'activée' : 'désactivée'}.`);
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Impossible de modifier cette politique.'
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={{ marginTop: 40 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div>
          <small style={{ color: '#f4c95d' }}>RÉCOMPENSES SERVEUR</small>
          <h2>Politiques et décisions</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 780 }}>
            Les règles sont versionnées. Chaque événement conserve la politique
            exacte, la décision anti-abus et l’écriture comptable associée.
          </p>
        </div>
        <button className="btn" onClick={() => void load()}>
          Actualiser
        </button>
      </div>

      {message && (
        <p role="alert" style={{ color: 'var(--orange)' }}>
          {message}
        </p>
      )}

      <form
        className="card"
        onSubmit={(event) => void createPolicy(event)}
        style={{ padding: 22, display: 'grid', gap: 12 }}
      >
        <h3>Créer une nouvelle version</h3>
        <label>
          Clé de politique
          <input name="key" defaultValue="challenge_completion" minLength={3} required />
        </label>
        <label>
          Type d’événement
          <input name="eventType" defaultValue="CHALLENGE_COMPLETION" minLength={3} required />
        </label>
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}
        >
          <label>
            Montant unitaire
            <input name="amount" type="number" min={1} max={100000} defaultValue={25} required />
          </label>
          <label>
            Plafond quotidien
            <input name="dailyLimitPerUser" type="number" min={1} max={1000000} defaultValue={100} required />
          </label>
          <label>
            Maximum par entité
            <input name="maxPerEntity" type="number" min={1} max={20} defaultValue={1} required />
          </label>
          <label>
            Questions minimum
            <input name="minQuestions" type="number" min={0} max={100} defaultValue={3} required />
          </label>
        </div>
        <label>
          Date de fin facultative
          <input name="endsAt" type="datetime-local" />
        </label>
        <label>
          Justification obligatoire
          <textarea name="reason" minLength={3} maxLength={500} rows={3} required />
        </label>
        <button className="btn btn-primary" disabled={busy === 'create'} type="submit">
          {busy === 'create' ? 'Création…' : 'Créer la nouvelle version'}
        </button>
      </form>

      <div className="grid" style={{ marginTop: 18 }}>
        {loading && <p>Chargement des politiques…</p>}
        {policies.map((policy) => (
          <article className="card" key={policy.id} style={{ padding: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                flexWrap: 'wrap'
              }}
            >
              <div>
                <strong>{policy.key} v{policy.version}</strong>
                <div style={{ color: 'var(--muted)' }}>{policy.eventType}</div>
              </div>
              <span
                style={{
                  color: policy.enabled ? 'var(--mint)' : 'var(--muted)',
                  fontWeight: 900
                }}
              >
                {policy.enabled ? 'ACTIVE' : 'DÉSACTIVÉE'}
              </span>
            </div>
            <p>
              <strong>{policy.amount} KnowCoins</strong> · plafond {policy.dailyLimitPerUser}/jour · minimum {policy.minQuestions} questions
            </p>
            <p style={{ color: 'var(--muted)' }}>
              Maximum {policy.maxPerEntity} par entité · début{' '}
              {new Date(policy.startsAt).toLocaleString('fr-FR')}
              {policy.endsAt ? ` · fin ${new Date(policy.endsAt).toLocaleString('fr-FR')}` : ''}
            </p>
            <p>{policy.reason}</p>
            <button
              className="btn"
              disabled={busy === policy.id}
              onClick={() => void toggle(policy)}
            >
              {policy.enabled ? 'Désactiver' : 'Réactiver'}
            </button>
          </article>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <h3>Dernières décisions</h3>
        <div className="grid">
          {events.slice(0, 100).map((event) => (
            <article className="card" key={event.id} style={{ padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap'
                }}
              >
                <strong>{event.user.displayName} (@{event.user.username})</strong>
                <span
                  style={{
                    color:
                      event.status === 'AWARDED'
                        ? 'var(--mint)'
                        : event.status === 'REJECTED'
                          ? 'var(--orange)'
                          : 'var(--muted)',
                    fontWeight: 900
                  }}
                >
                  {event.status}
                </span>
              </div>
              <p>
                {event.eventType} · {event.amount > 0 ? `+${event.amount}` : '0'} KnowCoins
              </p>
              <p>{event.explanation ?? event.reasonCode ?? 'Décision enregistrée.'}</p>
              <small style={{ color: 'var(--muted)' }}>
                {event.policy.key} v{event.policy.version} · {event.entityType}:{event.entityId} ·{' '}
                {new Date(event.createdAt).toLocaleString('fr-FR')}
              </small>
            </article>
          ))}
          {!events.length && !loading && (
            <article className="card" style={{ padding: 18 }}>
              Aucun événement de récompense.
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

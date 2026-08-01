'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Policy = {
  id: string;
  key: string;
  version: number;
  locale: string;
  title: string;
  summary: string;
  required: boolean;
  effectiveAt: string;
  retiredAt?: string | null;
};

type RetentionPolicy = {
  id: string;
  key: string;
  resourceType: string;
  retentionDays: number;
  gracePeriodDays: number;
  action: string;
  enabled: boolean;
  legalBasis: string;
  reason: string;
};

function read(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim();
}

export default function AdminPrivacyPage() {
  const { loading: sessionLoading } = useSession({ required: true });
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [retention, setRetention] = useState<RetentionPolicy[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [policyResult, retentionResult] = await Promise.all([
        apiFetch<Policy[]>('/privacy/admin/policies'),
        apiFetch<RetentionPolicy[]>('/privacy/admin/retention')
      ]);
      setPolicies(policyResult);
      setRetention(retentionResult);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Administration de confidentialité indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch('/privacy/admin/policies', {
        method: 'POST',
        body: JSON.stringify({
          key: read(form, 'key'),
          version: Number(read(form, 'version')),
          locale: read(form, 'locale') || 'fr',
          title: read(form, 'title'),
          summary: read(form, 'summary'),
          contentHash: read(form, 'contentHash').toLowerCase(),
          required: form.get('required') === 'on',
          effectiveAt: read(form, 'effectiveAt')
        })
      });
      event.currentTarget.reset();
      await load();
      setMessage('Nouvelle version publiée. Les clients devront accepter exactement cette version.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Publication impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function saveRetention(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch('/privacy/admin/retention', {
        method: 'POST',
        body: JSON.stringify({
          key: read(form, 'key'),
          resourceType: read(form, 'resourceType'),
          retentionDays: Number(read(form, 'retentionDays')),
          gracePeriodDays: Number(read(form, 'gracePeriodDays')),
          action: read(form, 'action'),
          enabled: form.get('enabled') === 'on',
          legalBasis: read(form, 'legalBasis'),
          reason: read(form, 'reason')
        })
      });
      event.currentTarget.reset();
      await load();
      setMessage('Politique de conservation enregistrée.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function execute(policy: RetentionPolicy) {
    if (!confirm(`Exécuter ${policy.key} sur les données antérieures à sa date limite ?`)) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ deletedCount: number; anonymizedCount: number }>(
        `/privacy/admin/retention/${policy.id}/execute`,
        { method: 'POST' }
      );
      setMessage(`Exécution terminée : ${result.deletedCount} suppression(s), ${result.anonymizedCount} anonymisation(s).`);
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Exécution impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading) return <main className="shell"><p>Chargement…</p></main>;

  return (
    <main className="shell" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ marginBottom: 28 }}>
        <small style={{ color: '#f4c95d' }}>PRIVACY OPERATIONS</small>
        <h1>Politiques et conservation</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 800 }}>
          Chaque publication et chaque nettoyage est contrôlé par la permission <code>privacy.manage</code> et enregistré dans l’audit.
        </p>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section className="grid" style={{ alignItems: 'start', marginBottom: 34 }}>
        <form className="card" onSubmit={publish} style={{ padding: 22, display: 'grid', gap: 12 }}>
          <h2>Publier une version</h2>
          <input name="key" minLength={2} maxLength={80} required placeholder="Clé : terms, privacy, analytics…" />
          <div style={{ display: 'flex', gap: 10 }}>
            <input name="version" type="number" min={1} required placeholder="Version" style={{ flex: 1 }} />
            <input name="locale" defaultValue="fr" minLength={2} maxLength={12} required style={{ flex: 1 }} />
          </div>
          <input name="title" minLength={2} maxLength={160} required placeholder="Titre public" />
          <textarea name="summary" minLength={10} maxLength={2000} required placeholder="Résumé compréhensible" />
          <input name="contentHash" pattern="[a-fA-F0-9]{64}" required placeholder="SHA-256 du document final" />
          <input name="effectiveAt" type="datetime-local" required />
          <label><input name="required" type="checkbox" /> Politique indispensable au service</label>
          <button className="btn" disabled={busy}>Publier</button>
        </form>

        <form className="card" onSubmit={saveRetention} style={{ padding: 22, display: 'grid', gap: 12 }}>
          <h2>Règle de conservation</h2>
          <input name="key" minLength={2} maxLength={80} required placeholder="Clé interne stable" />
          <select name="resourceType" defaultValue="SECURITY_CHALLENGE">
            <option value="SECURITY_CHALLENGE">Challenges de sécurité expirés</option>
            <option value="REAUTHENTICATION_PROOF">Preuves de réauthentification</option>
            <option value="AUTH_SESSION">Sessions expirées ou révoquées</option>
            <option value="READ_NOTIFICATION">Notifications déjà lues</option>
          </select>
          <div style={{ display: 'flex', gap: 10 }}>
            <input name="retentionDays" type="number" min={1} max={36500} required placeholder="Jours" style={{ flex: 1 }} />
            <input name="gracePeriodDays" type="number" min={0} max={3650} defaultValue={0} required placeholder="Grâce" style={{ flex: 1 }} />
          </div>
          <select name="action" defaultValue="DELETE">
            <option value="DELETE">Supprimer</option>
            <option value="ANONYMIZE">Anonymiser — bloqué sans implémentation dédiée</option>
          </select>
          <input name="legalBasis" minLength={3} maxLength={160} required placeholder="Base légale" />
          <textarea name="reason" minLength={5} maxLength={500} required placeholder="Justification opérationnelle" />
          <label><input name="enabled" type="checkbox" defaultChecked /> Active</label>
          <button className="btn" disabled={busy}>Enregistrer</button>
        </form>
      </section>

      <section style={{ marginBottom: 34 }}>
        <h2>Versions publiées</h2>
        <div className="grid">
          {policies.map((policy) => (
            <article className="card" key={policy.id} style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong>{policy.title}</strong>
                <span style={{ color: policy.required ? 'var(--orange)' : 'var(--mint)' }}>
                  {policy.required ? 'Requise' : 'Facultative'}
                </span>
              </div>
              <p>{policy.key} · v{policy.version} · {policy.locale}</p>
              <small style={{ color: 'var(--muted)' }}>
                Effective le {new Date(policy.effectiveAt).toLocaleString('fr-FR')}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Règles exécutables</h2>
        <div className="grid">
          {retention.map((policy) => (
            <article className="card" key={policy.id} style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong>{policy.key}</strong>
                <span style={{ color: policy.enabled ? 'var(--mint)' : 'var(--muted)' }}>
                  {policy.enabled ? 'Active' : 'Désactivée'}
                </span>
              </div>
              <p>{policy.resourceType} · {policy.action} après {policy.retentionDays} jour(s) + {policy.gracePeriodDays} de grâce</p>
              <small style={{ color: 'var(--muted)' }}>{policy.legalBasis} · {policy.reason}</small>
              <button className="btn" disabled={busy || !policy.enabled} onClick={() => void execute(policy)} style={{ marginTop: 14 }}>
                Exécuter maintenant
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

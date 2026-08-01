'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type FeatureFlagRule = {
  id: string;
  enabled: boolean;
  platform?: string | null;
  country?: string | null;
  minVersion?: string | null;
  rolloutPercentage?: number | null;
  audience?: string | null;
  priority: number;
};

type FeatureFlagOverride = {
  id: string;
  userId: string;
  enabled: boolean;
  expiresAt?: string | null;
  user: { id: string; username: string; displayName: string };
};

type FeatureFlag = {
  id: string;
  key: string;
  description?: string | null;
  enabled: boolean;
  exposeToClient: boolean;
  riskLevel: string;
  owner?: string | null;
  reviewAt?: string | null;
  rules: FeatureFlagRule[];
  overrides: FeatureFlagOverride[];
};

const emptyRule = {
  enabled: false,
  platform: '',
  country: '',
  minVersion: '',
  rolloutPercentage: '',
  priority: '0'
};

export function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [newFlag, setNewFlag] = useState({
    key: '',
    description: '',
    owner: '',
    riskLevel: 'NORMAL',
    enabled: false,
    exposeToClient: false
  });
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, typeof emptyRule>>({});
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setFlags(await apiFetch<FeatureFlag[]>('/admin/feature-flags'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Feature flags indisponibles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createFlag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newFlag.key.trim()) return;
    setBusy('create');
    try {
      await apiFetch('/admin/feature-flags', {
        method: 'POST',
        body: JSON.stringify({
          ...newFlag,
          key: newFlag.key.trim().toLowerCase(),
          description: newFlag.description.trim() || undefined,
          owner: newFlag.owner.trim() || undefined
        })
      });
      setNewFlag({
        key: '',
        description: '',
        owner: '',
        riskLevel: 'NORMAL',
        enabled: false,
        exposeToClient: false
      });
      await load();
      setMessage('Feature flag créé.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Création impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function patchFlag(flag: FeatureFlag, patch: Partial<FeatureFlag>) {
    setBusy(flag.key);
    try {
      await apiFetch(`/admin/feature-flags/${encodeURIComponent(flag.key)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      setFlags((current) => current.map((item) =>
        item.id === flag.id ? { ...item, ...patch } : item
      ));
      setMessage(`Le flag ${flag.key} a été mis à jour.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Modification impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function addRule(event: FormEvent<HTMLFormElement>, flag: FeatureFlag) {
    event.preventDefault();
    const draft = ruleDrafts[flag.id] ?? emptyRule;
    setBusy(`rule:${flag.id}`);
    try {
      await apiFetch(`/admin/feature-flags/${encodeURIComponent(flag.key)}/rules`, {
        method: 'POST',
        body: JSON.stringify({
          enabled: draft.enabled,
          platform: draft.platform.trim() || undefined,
          country: draft.country.trim() || undefined,
          minVersion: draft.minVersion.trim() || undefined,
          rolloutPercentage: draft.rolloutPercentage === ''
            ? undefined
            : Number(draft.rolloutPercentage),
          priority: Number(draft.priority || 0)
        })
      });
      setRuleDrafts((current) => ({ ...current, [flag.id]: { ...emptyRule } }));
      await load();
      setMessage(`Règle ajoutée à ${flag.key}.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Règle invalide.');
    } finally {
      setBusy(null);
    }
  }

  async function removeRule(flag: FeatureFlag, ruleId: string) {
    setBusy(`rule:${ruleId}`);
    try {
      await apiFetch(
        `/admin/feature-flags/${encodeURIComponent(flag.key)}/rules/${ruleId}`,
        { method: 'DELETE' }
      );
      setFlags((current) => current.map((item) =>
        item.id === flag.id
          ? { ...item, rules: item.rules.filter((rule) => rule.id !== ruleId) }
          : item
      ));
      setMessage('Règle supprimée.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function setOverride(event: FormEvent<HTMLFormElement>, flag: FeatureFlag) {
    event.preventDefault();
    const userId = overrideDrafts[flag.id]?.trim();
    if (!userId) return;
    setBusy(`override:${flag.id}`);
    try {
      await apiFetch(
        `/admin/feature-flags/${encodeURIComponent(flag.key)}/overrides/${userId}`,
        { method: 'PUT', body: JSON.stringify({ enabled: true }) }
      );
      setOverrideDrafts((current) => ({ ...current, [flag.id]: '' }));
      await load();
      setMessage(`Accès de test accordé pour ${flag.key}.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Override impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function removeOverride(flag: FeatureFlag, userId: string) {
    setBusy(`override:${userId}`);
    try {
      await apiFetch(
        `/admin/feature-flags/${encodeURIComponent(flag.key)}/overrides/${userId}`,
        { method: 'DELETE' }
      );
      setFlags((current) => current.map((item) =>
        item.id === flag.id
          ? { ...item, overrides: item.overrides.filter((entry) => entry.userId !== userId) }
          : item
      ));
      setMessage('Override supprimé.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={{ marginTop: 32 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--mint)' }}>DÉPLOIEMENT PROGRESSIF</small>
          <h2>Feature flags</h2>
          <p style={{ color: 'var(--muted)' }}>
            Le bouton principal reste un arrêt d’urgence : désactivé, aucune règle ou exception ne peut réactiver le flag.
          </p>
        </div>
        <button className="btn" onClick={() => void load()} disabled={loading}>Actualiser</button>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <form className="card" onSubmit={createFlag} style={{ padding: 20, display: 'grid', gap: 12 }}>
        <h3>Créer un flag</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <input
            className="input"
            required
            pattern="[a-z0-9][a-z0-9._-]{1,99}"
            placeholder="clé.exemple"
            value={newFlag.key}
            onChange={(event) => setNewFlag((current) => ({ ...current, key: event.target.value }))}
          />
          <input
            className="input"
            placeholder="Propriétaire"
            value={newFlag.owner}
            onChange={(event) => setNewFlag((current) => ({ ...current, owner: event.target.value }))}
          />
          <select
            className="input"
            value={newFlag.riskLevel}
            onChange={(event) => setNewFlag((current) => ({ ...current, riskLevel: event.target.value }))}
          >
            <option value="LOW">Risque faible</option>
            <option value="NORMAL">Risque normal</option>
            <option value="HIGH">Risque élevé</option>
            <option value="CRITICAL">Risque critique</option>
          </select>
        </div>
        <textarea
          className="input"
          placeholder="Description"
          value={newFlag.description}
          onChange={(event) => setNewFlag((current) => ({ ...current, description: event.target.value }))}
        />
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <label><input type="checkbox" checked={newFlag.enabled} onChange={(event) => setNewFlag((current) => ({ ...current, enabled: event.target.checked }))} /> Activer le master switch</label>
          <label><input type="checkbox" checked={newFlag.exposeToClient} onChange={(event) => setNewFlag((current) => ({ ...current, exposeToClient: event.target.checked }))} /> Exposer aux clients</label>
        </div>
        <button className="btn btn-primary" disabled={busy === 'create'}>
          {busy === 'create' ? 'Création…' : 'Créer le flag'}
        </button>
      </form>

      {loading && <p>Chargement des feature flags…</p>}

      <div className="grid" style={{ marginTop: 18 }}>
        {flags.map((flag) => {
          const rule = ruleDrafts[flag.id] ?? emptyRule;
          return (
            <article className="card" key={flag.id} style={{ padding: 22, display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>{flag.key}</h3>
                  <div style={{ color: 'var(--muted)' }}>{flag.description || 'Aucune description'}</div>
                  <small>{flag.riskLevel} · {flag.owner || 'sans propriétaire'}</small>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className={`btn ${flag.enabled ? 'btn-primary' : ''}`} disabled={busy === flag.key} onClick={() => void patchFlag(flag, { enabled: !flag.enabled })}>
                    {flag.enabled ? 'Master actif' : 'Master coupé'}
                  </button>
                  <button className="btn" disabled={busy === flag.key} onClick={() => void patchFlag(flag, { exposeToClient: !flag.exposeToClient })}>
                    {flag.exposeToClient ? 'Visible client' : 'Interne'}
                  </button>
                </div>
              </div>

              <div>
                <strong>Règles ({flag.rules.length})</strong>
                {flag.rules.map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
                    <span>
                      {entry.enabled ? 'ACTIVER' : 'DÉSACTIVER'} · priorité {entry.priority}
                      {entry.platform ? ` · ${entry.platform}` : ''}
                      {entry.country ? ` · ${entry.country}` : ''}
                      {entry.minVersion ? ` · ≥ ${entry.minVersion}` : ''}
                      {entry.rolloutPercentage !== null ? ` · ${entry.rolloutPercentage}%` : ''}
                    </span>
                    <button className="btn" disabled={busy === `rule:${entry.id}`} onClick={() => void removeRule(flag, entry.id)}>Supprimer</button>
                  </div>
                ))}
              </div>

              <form onSubmit={(event) => void addRule(event, flag)} style={{ display: 'grid', gap: 10 }}>
                <strong>Ajouter une règle</strong>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
                  <input className="input" placeholder="Plateforme" value={rule.platform} onChange={(event) => setRuleDrafts((current) => ({ ...current, [flag.id]: { ...rule, platform: event.target.value } }))} />
                  <input className="input" placeholder="Pays (BJ)" maxLength={2} value={rule.country} onChange={(event) => setRuleDrafts((current) => ({ ...current, [flag.id]: { ...rule, country: event.target.value } }))} />
                  <input className="input" placeholder="Version min." value={rule.minVersion} onChange={(event) => setRuleDrafts((current) => ({ ...current, [flag.id]: { ...rule, minVersion: event.target.value } }))} />
                  <input className="input" type="number" min="0" max="100" placeholder="Déploiement %" value={rule.rolloutPercentage} onChange={(event) => setRuleDrafts((current) => ({ ...current, [flag.id]: { ...rule, rolloutPercentage: event.target.value } }))} />
                  <input className="input" type="number" min="-1000" max="1000" placeholder="Priorité" value={rule.priority} onChange={(event) => setRuleDrafts((current) => ({ ...current, [flag.id]: { ...rule, priority: event.target.value } }))} />
                </div>
                <label><input type="checkbox" checked={rule.enabled} onChange={(event) => setRuleDrafts((current) => ({ ...current, [flag.id]: { ...rule, enabled: event.target.checked } }))} /> La règle active le flag</label>
                <button className="btn" disabled={busy === `rule:${flag.id}`}>Ajouter la règle</button>
              </form>

              <div>
                <strong>Utilisateurs de test ({flag.overrides.length})</strong>
                {flag.overrides.map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', flexWrap: 'wrap' }}>
                    <span>{entry.user.displayName} (@{entry.user.username}) · {entry.enabled ? 'activé' : 'désactivé'}</span>
                    <button className="btn" disabled={busy === `override:${entry.userId}`} onClick={() => void removeOverride(flag, entry.userId)}>Retirer</button>
                  </div>
                ))}
                <form onSubmit={(event) => void setOverride(event, flag)} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                  <input className="input" style={{ flex: 1 }} placeholder="ID utilisateur" value={overrideDrafts[flag.id] ?? ''} onChange={(event) => setOverrideDrafts((current) => ({ ...current, [flag.id]: event.target.value }))} />
                  <button className="btn" disabled={busy === `override:${flag.id}`}>Accorder un accès test</button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

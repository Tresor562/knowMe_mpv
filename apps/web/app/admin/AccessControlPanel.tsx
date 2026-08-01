'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type AccessRole = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  system: boolean;
  permissions: Array<{
    permission: { id: string; key: string; description: string };
  }>;
};

type RoleGrant = {
  id: string;
  userId: string;
  source: string;
  startsAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  reason: string;
  role: { id: string; key: string; name: string };
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string;
  };
};

export function AccessControlPanel() {
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [grants, setGrants] = useState<RoleGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [catalog, assignments] = await Promise.all([
        apiFetch<AccessRole[]>('/admin/access-control/catalog'),
        apiFetch<RoleGrant[]>('/admin/access-control/grants')
      ]);
      setRoles(catalog);
      setGrants(assignments);
      setMessage('');
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger les permissions.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const expiresAt = String(data.get('expiresAt') ?? '').trim();
    setBusy('create');

    try {
      await apiFetch('/admin/access-control/grants', {
        method: 'POST',
        body: JSON.stringify({
          userId: String(data.get('userId') ?? '').trim(),
          roleKey: String(data.get('roleKey') ?? '').trim(),
          source: 'ADMIN',
          reason: String(data.get('reason') ?? '').trim(),
          ...(expiresAt
            ? { expiresAt: new Date(expiresAt).toISOString() }
            : {})
        })
      });
      form.reset();
      setMessage('Rôle attribué par le serveur.');
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Attribution impossible.'
      );
    } finally {
      setBusy(null);
    }
  }

  async function revoke(grant: RoleGrant) {
    const reason = window.prompt(
      `Motif obligatoire pour retirer ${grant.role.name} à ${grant.user.displayName} :`
    )?.trim();
    if (!reason) return;

    setBusy(grant.id);
    try {
      await apiFetch(`/admin/access-control/grants/${grant.id}/revoke`, {
        method: 'PATCH',
        body: JSON.stringify({ reason })
      });
      setMessage('Attribution révoquée immédiatement.');
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Révocation impossible.'
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
          <small style={{ color: 'var(--mint)' }}>CONTRÔLE D’ACCÈS</small>
          <h2>Rôles et permissions</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
            Chaque action sensible exige une permission précise. Les valeurs du
            navigateur, du JWT ou d’une application modifiée ne suffisent pas.
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

      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          marginBottom: 18
        }}
      >
        {roles.map((role) => (
          <article className="card" key={role.id} style={{ padding: 18 }}>
            <strong>{role.name}</strong>
            <div style={{ color: 'var(--muted)' }}>{role.key}</div>
            {role.description && <p>{role.description}</p>}
            <ul style={{ paddingLeft: 20 }}>
              {role.permissions.map(({ permission }) => (
                <li key={permission.id} title={permission.description}>
                  <code>{permission.key}</code>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <form
        className="card"
        onSubmit={(event) => void grant(event)}
        style={{ padding: 22, display: 'grid', gap: 12 }}
      >
        <h3>Attribuer un rôle</h3>
        <label>
          Identifiant du compte
          <input name="userId" minLength={10} required placeholder="accountId" />
        </label>
        <label>
          Rôle
          <select name="roleKey" required defaultValue="moderator">
            {roles.map((role) => (
              <option key={role.id} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Expiration facultative
          <input name="expiresAt" type="datetime-local" />
        </label>
        <label>
          Justification obligatoire
          <textarea
            name="reason"
            minLength={3}
            maxLength={500}
            rows={3}
            required
          />
        </label>
        <button
          className="btn btn-primary"
          disabled={busy === 'create'}
          type="submit"
        >
          {busy === 'create' ? 'Attribution…' : 'Attribuer le rôle'}
        </button>
      </form>

      <div className="grid" style={{ marginTop: 18 }}>
        {loading && <p>Chargement des attributions…</p>}
        {!loading && !grants.length && (
          <article className="card" style={{ padding: 18 }}>
            Aucune attribution enregistrée.
          </article>
        )}
        {grants.map((grant) => {
          const active =
            !grant.revokedAt &&
            (!grant.expiresAt || new Date(grant.expiresAt) > new Date());
          return (
            <article className="card" key={grant.id} style={{ padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <strong>{grant.role.name}</strong>
                  <div>
                    {grant.user.displayName} (@{grant.user.username})
                  </div>
                  <code>{grant.userId}</code>
                </div>
                <strong style={{ color: active ? 'var(--mint)' : 'var(--muted)' }}>
                  {active ? 'ACTIF' : 'INACTIF'}
                </strong>
              </div>
              <p style={{ color: 'var(--muted)' }}>
                Source : {grant.source}
                {grant.expiresAt
                  ? ` · expiration ${new Date(grant.expiresAt).toLocaleString('fr-FR')}`
                  : ' · sans expiration'}
              </p>
              <p>{grant.reason}</p>
              {active && (
                <button
                  className="btn"
                  disabled={busy === grant.id}
                  onClick={() => void revoke(grant)}
                >
                  Révoquer
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

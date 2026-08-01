'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type Grant = {
  id: string;
  userId: string;
  key: string;
  source: string;
  startsAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  reason: string | null;
  user: {
    id: string;
    username: string;
    displayName: string;
  };
};

export function EntitlementsPanel() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<Grant[]>('/admin/entitlements/grants');
      setGrants(result);
      setMessage('');
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger les droits exclusifs.'
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

    try {
      await apiFetch('/admin/entitlements/grants', {
        method: 'POST',
        body: JSON.stringify({
          userId: String(data.get('userId') ?? '').trim(),
          key: String(data.get('key') ?? '').trim().toLowerCase(),
          source: String(data.get('source') ?? 'ADMIN'),
          reason: String(data.get('reason') ?? '').trim(),
          ...(expiresAt
            ? { expiresAt: new Date(expiresAt).toISOString() }
            : {})
        })
      });
      form.reset();
      setMessage('Droit exclusif accordé par le serveur.');
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Impossible d’accorder ce droit.'
      );
    }
  }

  async function revoke(id: string) {
    try {
      await apiFetch(`/admin/entitlements/grants/${id}/revoke`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Révocation depuis l’administration Web.' })
      });
      setMessage('Droit révoqué immédiatement.');
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Impossible de révoquer ce droit.'
      );
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
          <small style={{ color: 'var(--orange)' }}>DROITS SERVEUR</small>
          <h2>Fonctionnalités exclusives</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 720 }}>
            Les droits sont liés à l’identifiant immuable du compte. Une valeur
            modifiée dans le navigateur ou l’application mobile ne peut pas les
            remplacer.
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
        onSubmit={(event) => void grant(event)}
        style={{ padding: 22, display: 'grid', gap: 12 }}
      >
        <h3>Accorder un droit</h3>
        <label>
          Identifiant du compte
          <input name="userId" required placeholder="accountId" />
        </label>
        <label>
          Clé du droit
          <input name="key" required defaultValue="premium.core" />
        </label>
        <label>
          Source
          <select name="source" defaultValue="ADMIN">
            <option value="ADMIN">Administration</option>
            <option value="SUBSCRIPTION">Abonnement vérifié</option>
            <option value="PURCHASE">Achat vérifié</option>
            <option value="PROMOTION">Promotion</option>
            <option value="SYSTEM">Système</option>
            <option value="MIGRATION">Migration</option>
          </select>
        </label>
        <label>
          Expiration facultative
          <input name="expiresAt" type="datetime-local" />
        </label>
        <label>
          Justification
          <input
            name="reason"
            required
            minLength={3}
            placeholder="Pourquoi ce compte reçoit-il ce droit ?"
          />
        </label>
        <button className="btn btn-primary" type="submit">
          Accorder côté serveur
        </button>
      </form>

      <div className="grid" style={{ marginTop: 18 }}>
        {loading && <p>Chargement des droits…</p>}
        {!loading &&
          grants.map((grant) => {
            const active =
              !grant.revokedAt &&
              (!grant.expiresAt || new Date(grant.expiresAt) > new Date());

            return (
              <article className="card" key={grant.id} style={{ padding: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <strong>{grant.key}</strong>
                    <div style={{ color: 'var(--muted)' }}>
                      {grant.user.displayName} (@{grant.user.username})
                    </div>
                    <code>{grant.userId}</code>
                  </div>
                  <span>{active ? 'ACTIF' : 'INACTIF'}</span>
                </div>
                <p style={{ color: 'var(--muted)' }}>
                  Source : {grant.source}
                  {grant.expiresAt
                    ? ` · expire le ${new Date(grant.expiresAt).toLocaleString('fr-FR')}`
                    : ' · sans expiration'}
                </p>
                {grant.reason && <p>{grant.reason}</p>}
                {active && (
                  <button className="btn" onClick={() => void revoke(grant.id)}>
                    Révoquer immédiatement
                  </button>
                )}
              </article>
            );
          })}
      </div>
    </section>
  );
}

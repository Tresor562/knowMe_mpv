'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type StaffAccount = {
  id: string;
  userId: string;
  staffRole: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  badgeLabel: string;
  shieldStyle: string;
  grantsAdminAccess: boolean;
  reason: string;
  activatedAt: string;
  suspendedAt: string | null;
  revokedAt: string | null;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
  };
};

const STAFF_ROLES = [
  ['OWNER', 'Propriétaire'],
  ['ADMINISTRATOR', 'Administrateur'],
  ['MODERATOR', 'Modérateur'],
  ['SUPPORT', 'Support'],
  ['DEVELOPER', 'Développeur'],
  ['COMMUNITY_MANAGER', 'Community manager']
] as const;

export function StaffAccountsPanel() {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<StaffAccount[]>('/admin/staff-accounts');
      setAccounts(result);
      setMessage('');
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger les comptes de l’équipe.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const emails = [...new Set(String(data.get('emails') ?? '')
      .split(/[\s,;]+/).map(value => value.trim().toLowerCase()).filter(Boolean))];
    if (emails.length === 0 || emails.length > 8) {
      setMessage('Indique entre une et huit adresses e-mail.');
      return;
    }
    setBusyId('create');
    let activated = 0;
    const failed: string[] = [];
    for (const email of emails) {
      try {
        await apiFetch('/admin/staff-accounts/by-email', {
          method: 'POST',
          body: JSON.stringify({
            email,
            staffRole: String(data.get('staffRole') ?? 'OWNER'),
            grantsAdminAccess: data.get('grantsAdminAccess') === 'on',
            reason: String(data.get('reason') ?? '').trim()
          })
        });
        activated += 1;
      } catch (cause) {
        failed.push(`${email} : ${cause instanceof Error ? cause.message : 'échec'}`);
      }
    }
    try {
      await load();
      if (!failed.length) form.reset();
      setMessage(`${activated} compte(s) activé(s). ${failed.length ? failed.join(' ; ') : ''}`);
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(
    account: StaffAccount,
    status: StaffAccount['status']
  ) {
    const labels = {
      ACTIVE: 'réactiver',
      SUSPENDED: 'suspendre',
      REVOKED: 'révoquer'
    } as const;
    const reason = window.prompt(
      `Motif obligatoire pour ${labels[status]} ${account.user.displayName} :`
    )?.trim();
    if (!reason) return;

    setBusyId(account.id);
    try {
      await apiFetch(`/admin/staff-accounts/${account.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason })
      });
      setMessage(`Statut staff mis à jour : ${status}.`);
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Impossible de modifier ce compte staff.'
      );
    } finally {
      setBusyId(null);
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
          <small style={{ color: '#f4c95d' }}>ÉQUIPE KNOWME</small>
          <h2>Comptes officiels</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
            Badge doré lié au compte KnowMe, jamais attribué automatiquement
            lors d’une inscription. Vérifiez que chaque adresse appartient à
            son propriétaire avant de confirmer son statut officiel.
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
        onSubmit={(event) => void activate(event)}
        style={{ padding: 22, display: 'grid', gap: 12 }}
      >
        <h3>Ajouter un membre officiel</h3>
        <label>
          Adresses e-mail des comptes KnowMe (une par ligne, jusqu’à huit)
          <textarea name="emails" required rows={3}
            placeholder="adresse1@gmail.com&#10;adresse2@gmail.com"
            aria-label="Adresses e-mail des comptes à certifier" />
        </label>
        <label>
          Fonction dans l’équipe
          <select name="staffRole" defaultValue="OWNER">
            {STAFF_ROLES.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input name="grantsAdminAccess" type="checkbox" />
          Accorder aussi les accès administratifs (facultatif, réservé aux comptes autorisés)
        </label>
        <label>
          Justification obligatoire
          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={500}
            rows={3}
            placeholder="Rôle officiel, décision et référence interne…"
          />
        </label>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={busyId === 'create'}
        >
          {busyId === 'create' ? 'Activation…' : 'Activer le compte officiel'}
        </button>
      </form>

      <div className="grid" style={{ marginTop: 18 }}>
        {loading && <p>Chargement des comptes officiels…</p>}
        {!loading && !accounts.length && (
          <article className="card" style={{ padding: 20 }}>
            Aucun compte staff enregistré.
          </article>
        )}
        {accounts.map((account) => (
          <article className="card" key={account.id} style={{ padding: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
                flexWrap: 'wrap'
              }}
            >
              <div>
                <strong style={{ fontSize: 18 }}>
                  🛡️ {account.user.displayName}
                </strong>
                <div style={{ color: 'var(--muted)' }}>
                  @{account.user.username} · {account.user.email}
                </div>
                <code>{account.userId}</code>
              </div>
              <span
                style={{
                  border: '1px solid #f4c95d',
                  borderRadius: 999,
                  padding: '7px 11px',
                  color: '#f4c95d',
                  fontWeight: 800
                }}
              >
                {account.status}
              </span>
            </div>

            <p>
              <strong>{account.badgeLabel}</strong> · {account.staffRole} ·
              bouclier {account.shieldStyle}
            </p>
            <p style={{ color: 'var(--muted)' }}>
              Accès admin : {account.grantsAdminAccess ? 'oui' : 'non'} · rôle
              courant : {account.user.role}
            </p>
            <p>{account.reason}</p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {account.status !== 'ACTIVE' && (
                <button
                  className="btn btn-primary"
                  disabled={busyId === account.id}
                  onClick={() => void changeStatus(account, 'ACTIVE')}
                >
                  Réactiver
                </button>
              )}
              {account.status === 'ACTIVE' && (
                <button
                  className="btn"
                  disabled={busyId === account.id}
                  onClick={() => void changeStatus(account, 'SUSPENDED')}
                >
                  Suspendre
                </button>
              )}
              {account.status !== 'REVOKED' && (
                <button
                  className="btn"
                  disabled={busyId === account.id}
                  onClick={() => void changeStatus(account, 'REVOKED')}
                >
                  Révoquer
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

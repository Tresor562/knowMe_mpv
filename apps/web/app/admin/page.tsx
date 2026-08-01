'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useAccessControl } from '../../lib/use-access-control';
import { useSession } from '../../lib/use-session';
import { AccessControlPanel } from './AccessControlPanel';
import { EntitlementsPanel } from './EntitlementsPanel';
import { FeatureFlagsPanel } from './FeatureFlagsPanel';
import { RewardsPanel } from './RewardsPanel';
import { StaffAccountsPanel } from './StaffAccountsPanel';
import { WalletPanel } from './WalletPanel';

type Dashboard = {
  users: number;
  posts: number;
  challenges: number;
  openReports: number;
};

type Report = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter: { username: string; displayName: string };
};

const P = {
  dashboard: 'admin.dashboard.read',
  reportsRead: 'moderation.reports.read',
  reportsResolve: 'moderation.reports.resolve',
  staff: 'staff.manage',
  entitlements: 'entitlements.manage',
  wallet: 'wallet.manage',
  rewards: 'rewards.manage',
  flags: 'feature_flags.manage',
  rbac: 'rbac.manage'
} as const;

export default function AdminPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { access, loading: accessLoading, error: accessError, reload: reloadAccess } =
    useAccessControl(!sessionLoading && Boolean(user));
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const permissions = useMemo(
    () => new Set(access?.permissions ?? []),
    [access?.permissions]
  );
  const can = useCallback(
    (permission: string) => permissions.has(permission),
    [permissions]
  );

  const load = useCallback(async () => {
    if (!access) return;
    setLoading(true);
    try {
      const [stats, queue] = await Promise.all([
        can(P.dashboard)
          ? apiFetch<Dashboard>('/admin/dashboard')
          : Promise.resolve(null),
        can(P.reportsRead)
          ? apiFetch<Report[]>('/admin/reports?status=OPEN')
          : Promise.resolve([])
      ]);
      setDashboard(stats);
      setReports(queue);
      setMessage('');
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Accès administratif impossible.'
      );
    } finally {
      setLoading(false);
    }
  }, [access, can]);

  useEffect(() => {
    if (access) void load();
    else if (!sessionLoading && !accessLoading) setLoading(false);
  }, [access, accessLoading, load, sessionLoading]);

  async function refreshAll() {
    await reloadAccess();
    await load();
  }

  async function resolve(id: string, status: 'RESOLVED' | 'DISMISSED') {
    try {
      await apiFetch(`/admin/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setReports((current) => current.filter((report) => report.id !== id));
      setDashboard((current) =>
        current
          ? { ...current, openReports: Math.max(0, current.openReports - 1) }
          : current
      );
      setMessage(
        status === 'RESOLVED' ? 'Signalement résolu.' : 'Signalement rejeté.'
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Impossible de traiter ce signalement.'
      );
    }
  }

  if (sessionLoading || accessLoading || loading) {
    return (
      <main className="shell">
        <p>Chargement des autorisations…</p>
      </main>
    );
  }

  if (!access?.isAdministrative) {
    return (
      <main className="shell">
        <article className="card" style={{ padding: 24 }}>
          <h1>Accès refusé</h1>
          <p>Ton compte ne possède aucune permission administrative active.</p>
          {accessError && <p role="alert">{accessError}</p>}
        </article>
      </main>
    );
  }

  const stats = dashboard
    ? [
        ['Utilisateurs', dashboard.users],
        ['Publications', dashboard.posts],
        ['Défis', dashboard.challenges],
        ['Signalements ouverts', dashboard.openReports]
      ]
    : [];

  return (
    <main className="shell" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--orange)' }}>ADMINISTRATION</small>
        <h1>Centre de contrôle</h1>
        <p style={{ color: 'var(--muted)' }}>
          Connecté en tant que {user?.displayName}
          {user?.staff ? ` · ${user.staff.label}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {access.roles.map((role) => (
            <span
              key={role.grantId}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '6px 10px',
                color: 'var(--muted)'
              }}
            >
              {role.name}
            </span>
          ))}
        </div>
      </header>

      {message && (
        <p role="alert" style={{ color: 'var(--orange)' }}>
          {message}
        </p>
      )}

      {can(P.dashboard) && (
        <section
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}
        >
          {stats.map(([label, value]) => (
            <article className="card" key={label} style={{ padding: 22 }}>
              <div style={{ color: 'var(--muted)' }}>{label}</div>
              <strong style={{ fontSize: 32 }}>{value}</strong>
            </article>
          ))}
        </section>
      )}

      {can(P.reportsRead) && (
        <section style={{ marginTop: 28 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap'
            }}
          >
            <h2>File des signalements</h2>
            <button className="btn" onClick={() => void refreshAll()}>
              Actualiser
            </button>
          </div>

          <div className="grid">
            {reports.map((report) => (
              <article className="card" key={report.id} style={{ padding: 22 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <strong>{report.targetType}</strong>
                    <div style={{ color: 'var(--muted)' }}>
                      Cible : {report.targetId}
                    </div>
                  </div>
                  <small>{new Date(report.createdAt).toLocaleString('fr-FR')}</small>
                </div>
                <p>{report.reason}</p>
                <p style={{ color: 'var(--muted)' }}>
                  Signalé par {report.reporter.displayName} (@{report.reporter.username})
                </p>
                {can(P.reportsResolve) && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => void resolve(report.id, 'RESOLVED')}
                    >
                      Résoudre
                    </button>
                    <button
                      className="btn"
                      onClick={() => void resolve(report.id, 'DISMISSED')}
                    >
                      Rejeter
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!reports.length && (
              <article className="card" style={{ padding: 22, color: 'var(--muted)' }}>
                Aucun signalement ouvert.
              </article>
            )}
          </div>
        </section>
      )}

      {can(P.rbac) && <AccessControlPanel />}
      {can(P.staff) && <StaffAccountsPanel />}
      {can(P.entitlements) && <EntitlementsPanel />}
      {can(P.wallet) && <WalletPanel />}
      {can(P.rewards) && <RewardsPanel />}
      {can(P.flags) && <FeatureFlagsPanel />}
    </main>
  );
}

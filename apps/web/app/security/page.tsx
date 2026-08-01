'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  apiFetch,
  clearTrustedDeviceToken,
  getTrustedDeviceToken
} from '../../lib/api';
import { useSession } from '../../lib/use-session';

type SecurityStatus = {
  twoFactorEnabled: boolean;
  twoFactorConfirmedAt?: string | null;
  recoveryCodesRemaining: number;
  lockedUntil?: string | null;
  sessions: Array<{
    id: string;
    userAgent?: string | null;
    ipAddress?: string | null;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    current: boolean;
  }>;
  trustedDevices: Array<{
    id: string;
    label: string;
    platform?: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    trustedUntil: string;
    active: boolean;
    revokedAt?: string | null;
  }>;
  events: Array<{
    id: string;
    type: string;
    severity: string;
    userAgent?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
  }>;
};

type SetupResult = {
  secret: string;
  otpauthUri: string;
  algorithm: string;
  digits: number;
  period: number;
};

type RecoveryResult = { recoveryCodes: string[] };
type ReauthResult = {
  proofToken: string;
  assurance: string;
  expiresAt: string;
};

type AccountExport = {
  exportedAt: string;
  formatVersion: number;
  account: unknown;
  security?: unknown;
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('fr-FR') : '—';
}

function downloadJson(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SecurityPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reauthToken, setReauthToken] = useState('');

  const load = useCallback(async () => {
    try {
      setStatus(await apiFetch<SecurityStatus>('/security'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Centre de sécurité indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function beginSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      setSetup(await apiFetch<SetupResult>('/security/2fa/setup', {
        method: 'POST',
        body: JSON.stringify({ password: String(form.get('password') ?? '') })
      }));
      setRecoveryCodes([]);
      setMessage('Secret généré. Ajoute-le à ton application d’authentification puis confirme un code.');
      event.currentTarget.reset();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Configuration impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<RecoveryResult>('/security/2fa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: String(form.get('code') ?? '').trim() })
      });
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      setMessage('2FA activé. Enregistre les codes de récupération maintenant : ils ne seront plus affichés.');
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Code invalide.');
    } finally {
      setBusy(false);
    }
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm('Désactiver le second facteur et révoquer les appareils de confiance ?')) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch('/security/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({
          password: String(form.get('password') ?? ''),
          code: String(form.get('code') ?? '').trim()
        })
      });
      clearTrustedDeviceToken();
      setRecoveryCodes([]);
      setMessage('2FA désactivé. Les autres sessions et appareils de confiance ont été révoqués.');
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Désactivation impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm('Les anciens codes non utilisés seront invalidés. Continuer ?')) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<RecoveryResult>('/security/recovery-codes/regenerate', {
        method: 'POST',
        body: JSON.stringify({
          password: String(form.get('password') ?? ''),
          code: String(form.get('code') ?? '').trim()
        })
      });
      setRecoveryCodes(result.recoveryCodes);
      setMessage('Nouveaux codes générés. Copie-les avant de quitter la page.');
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Régénération impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch('/security/password', {
        method: 'PATCH',
        body: JSON.stringify({
          password: String(form.get('password') ?? ''),
          newPassword: String(form.get('newPassword') ?? ''),
          code: String(form.get('code') ?? '').trim() || undefined
        })
      });
      clearTrustedDeviceToken();
      setMessage('Mot de passe modifié. Les autres sessions et appareils de confiance ont été révoqués.');
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function reauthenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<ReauthResult>('/security/reauthenticate', {
        method: 'POST',
        body: JSON.stringify({
          password: String(form.get('password') ?? ''),
          code: String(form.get('code') ?? '').trim() || undefined
        })
      });
      setReauthToken(result.proofToken);
      setMessage(`Réauthentification valide jusqu’au ${formatDate(result.expiresAt)} et utilisable une seule fois.`);
      event.currentTarget.reset();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Réauthentification impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function exportAccount() {
    setBusy(true);
    try {
      const data = await apiFetch<AccountExport>('/account/export', {
        headers: reauthToken ? { 'x-reauth-token': reauthToken } : undefined
      });
      downloadJson(`knowme-export-${new Date().toISOString().slice(0, 10)}.json`, data);
      setReauthToken('');
      setMessage('Export généré. La preuve de réauthentification a été consommée.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Export impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(id: string, current: boolean) {
    if (!window.confirm(current ? 'Fermer la session actuelle ?' : 'Révoquer cette session ?')) return;
    setBusy(true);
    try {
      await apiFetch(`/auth/sessions/${id}`, { method: 'DELETE' });
      if (current) {
        window.location.replace('/login');
        return;
      }
      setMessage('Session révoquée.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Révocation impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function renameDevice(id: string, currentLabel: string) {
    const label = window.prompt('Nom de l’appareil', currentLabel)?.trim();
    if (!label) return;
    setBusy(true);
    try {
      await apiFetch(`/security/devices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ label })
      });
      setMessage('Appareil renommé.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeDevice(id: string) {
    if (!window.confirm('Révoquer cet appareil de confiance ?')) return;
    setBusy(true);
    try {
      await apiFetch(`/security/devices/${id}`, { method: 'DELETE' });
      if (getTrustedDeviceToken()) clearTrustedDeviceToken();
      setMessage('Appareil révoqué. Il devra fournir un second facteur à sa prochaine connexion.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Révocation impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || !user || !status) {
    return <main className="shell"><p>{message || 'Chargement de la sécurité…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 1050, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--orange)' }}>PROTECTION DU COMPTE</small>
        <h1>Centre de sécurité</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
          Les décisions restent côté serveur. Modifier le navigateur ou l’application ne permet pas de créer une session, un appareil fiable ou une preuve de réauthentification.
        </p>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        <article className="card" style={{ padding: 22 }}>
          <small style={{ color: status.twoFactorEnabled ? 'var(--mint)' : 'var(--orange)' }}>SECOND FACTEUR</small>
          <h2>{status.twoFactorEnabled ? 'Activé' : 'Non activé'}</h2>
          <p style={{ color: 'var(--muted)' }}>Codes de récupération disponibles : {status.recoveryCodesRemaining}</p>
          {status.lockedUntil && <p style={{ color: 'var(--orange)' }}>Verrouillé jusqu’au {formatDate(status.lockedUntil)}</p>}
        </article>
        <article className="card" style={{ padding: 22 }}>
          <small style={{ color: 'var(--mint)' }}>APPAREILS</small>
          <h2>{status.trustedDevices.filter((device) => device.active).length} fiable(s)</h2>
          <p style={{ color: 'var(--muted)' }}>{status.sessions.length} session(s) active(s)</p>
        </article>
      </section>

      {!status.twoFactorEnabled && !setup && (
        <form className="card grid" onSubmit={beginSetup} style={{ padding: 24, marginTop: 24 }}>
          <h2>Activer le 2FA</h2>
          <p style={{ color: 'var(--muted)' }}>Confirme ton mot de passe avant que le serveur génère un secret chiffré.</p>
          <input className="input" name="password" type="password" autoComplete="current-password" placeholder="Mot de passe actuel" minLength={8} required />
          <button className="btn btn-primary" disabled={busy}>Commencer la configuration</button>
        </form>
      )}

      {setup && (
        <article className="card" style={{ padding: 24, marginTop: 24 }}>
          <h2>Ajouter KnowMe à ton application d’authentification</h2>
          <p style={{ color: 'var(--muted)' }}>Secret affiché une seule fois avant activation :</p>
          <code style={{ display: 'block', wordBreak: 'break-all', padding: 14, background: 'var(--surface-2)', borderRadius: 12 }}>{setup.secret}</code>
          <details style={{ marginTop: 12 }}>
            <summary>URI de configuration avancée</summary>
            <code style={{ display: 'block', wordBreak: 'break-all', marginTop: 10 }}>{setup.otpauthUri}</code>
          </details>
          <form className="grid" onSubmit={confirmSetup} style={{ marginTop: 18 }}>
            <input className="input" name="code" autoComplete="one-time-code" placeholder="Code à 6 chiffres" pattern="[0-9]{6}" required />
            <button className="btn btn-primary" disabled={busy}>Confirmer et activer</button>
          </form>
        </article>
      )}

      {recoveryCodes.length > 0 && (
        <article className="card" style={{ padding: 24, marginTop: 24, borderColor: 'var(--orange)' }}>
          <small style={{ color: 'var(--orange)' }}>À SAUVEGARDER MAINTENANT</small>
          <h2>Codes de récupération</h2>
          <p>Chaque code fonctionne une seule fois. Ils ne seront plus affichés après avoir quitté cette page.</p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
            {recoveryCodes.map((code) => <code key={code} style={{ padding: 10, background: 'var(--surface-2)', borderRadius: 10 }}>{code}</code>)}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button className="btn" onClick={() => void navigator.clipboard.writeText(recoveryCodes.join('\n'))}>Copier</button>
            <button className="btn" onClick={() => downloadJson('knowme-recovery-codes.json', { generatedAt: new Date().toISOString(), recoveryCodes })}>Télécharger</button>
            <button className="btn" onClick={() => setRecoveryCodes([])}>J’ai sauvegardé les codes</button>
          </div>
        </article>
      )}

      {status.twoFactorEnabled && (
        <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', marginTop: 24 }}>
          <form className="card grid" onSubmit={regenerateCodes} style={{ padding: 22 }}>
            <h2>Régénérer les codes</h2>
            <input className="input" name="password" type="password" placeholder="Mot de passe actuel" minLength={8} required />
            <input className="input" name="code" placeholder="Code 2FA ou récupération" required />
            <button className="btn" disabled={busy}>Créer 10 nouveaux codes</button>
          </form>
          <form className="card grid" onSubmit={disableTwoFactor} style={{ padding: 22 }}>
            <h2>Désactiver le 2FA</h2>
            <input className="input" name="password" type="password" placeholder="Mot de passe actuel" minLength={8} required />
            <input className="input" name="code" placeholder="Code 2FA ou récupération" required />
            <button className="btn" disabled={busy}>Désactiver et révoquer les appareils</button>
          </form>
        </section>
      )}

      <form className="card grid" onSubmit={changePassword} style={{ padding: 24, marginTop: 24 }}>
        <h2>Changer le mot de passe</h2>
        <input className="input" name="password" type="password" placeholder="Mot de passe actuel" minLength={8} required />
        <input className="input" name="newPassword" type="password" placeholder="Nouveau mot de passe fort" minLength={10} required />
        {status.twoFactorEnabled && <input className="input" name="code" placeholder="Code 2FA ou récupération" required />}
        <button className="btn btn-primary" disabled={busy}>Modifier et fermer les autres sessions</button>
      </form>

      <section style={{ marginTop: 28 }}>
        <h2>Sessions actives</h2>
        <div className="grid">
          {status.sessions.map((session) => (
            <article className="card" key={session.id} style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <strong>{session.current ? 'Session actuelle' : 'Autre session'}</strong>
                  <div style={{ color: 'var(--muted)' }}>{session.userAgent || 'Appareil non identifié'}</div>
                  <small style={{ color: 'var(--muted)' }}>Créée : {formatDate(session.createdAt)} · Expire : {formatDate(session.expiresAt)}</small>
                </div>
                <button className="btn" disabled={busy} onClick={() => void revokeSession(session.id, session.current)}>Révoquer</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Appareils de confiance</h2>
        <div className="grid">
          {status.trustedDevices.map((device) => (
            <article className="card" key={device.id} style={{ padding: 18, opacity: device.active ? 1 : .6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <strong>{device.label}</strong>
                  <div style={{ color: 'var(--muted)' }}>{device.platform || 'UNKNOWN'} · {device.active ? 'Actif' : 'Révoqué ou expiré'}</div>
                  <small style={{ color: 'var(--muted)' }}>Dernière activité : {formatDate(device.lastSeenAt)} · Confiance jusqu’au {formatDate(device.trustedUntil)}</small>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn" disabled={busy} onClick={() => void renameDevice(device.id, device.label)}>Renommer</button>
                  {device.active && <button className="btn" disabled={busy} onClick={() => void revokeDevice(device.id)}>Révoquer</button>}
                </div>
              </div>
            </article>
          ))}
          {!status.trustedDevices.length && <article className="card" style={{ padding: 18, color: 'var(--muted)' }}>Aucun appareil de confiance.</article>}
        </div>
      </section>

      <section className="card" style={{ padding: 24, marginTop: 28 }}>
        <h2>Réauthentification pour une action sensible</h2>
        <p style={{ color: 'var(--muted)' }}>Une preuve est liée à cette session, expire après 10 minutes et ne peut être utilisée qu’une fois.</p>
        <form className="grid" onSubmit={reauthenticate}>
          <input className="input" name="password" type="password" placeholder="Mot de passe actuel" minLength={8} required />
          {status.twoFactorEnabled && <input className="input" name="code" placeholder="Code 2FA ou récupération" required />}
          <button className="btn" disabled={busy}>Créer une preuve temporaire</button>
        </form>
        <button className="btn btn-accent" disabled={busy} onClick={() => void exportAccount()} style={{ marginTop: 12 }}>
          Exporter mes données {reauthToken ? 'avec la preuve' : ''}
        </button>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Journal de sécurité</h2>
        <div className="grid">
          {status.events.map((event) => (
            <article className="card" key={event.id} style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{event.type}</strong>
                <small>{event.severity} · {formatDate(event.createdAt)}</small>
              </div>
              {event.userAgent && <div style={{ color: 'var(--muted)' }}>{event.userAgent}</div>}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import {
  apiFetch,
  clearSession,
  clearTrustedDeviceToken
} from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type ReauthenticationResult = {
  proofToken: string;
  assurance: string;
  expiresAt: string;
  expiresIn: number;
};

type AccountExport = Record<string, unknown>;

function downloadJson(payload: AccountExport) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `knowme-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AccountDataRightsPage() {
  const { user, loading } = useSession({ required: true });
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [message, setMessage] = useState('');

  async function createSensitiveActionProof() {
    return apiFetch<ReauthenticationResult>('/security/reauthenticate', {
      method: 'POST',
      body: JSON.stringify({
        password,
        code: code.trim() ? code.trim().toUpperCase() : undefined
      })
    });
  }

  async function exportAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy('export');
    setMessage('');

    try {
      const proof = await createSensitiveActionProof();
      const data = await apiFetch<AccountExport>('/account/export', {
        headers: { 'x-reauth-token': proof.proofToken }
      });
      downloadJson(data);
      setPassword('');
      setCode('');
      setMessage('Ton export KnowMe a été préparé et téléchargé sur cet appareil.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Export impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || confirmation !== 'SUPPRIMER') return;
    setBusy('delete');
    setMessage('');

    try {
      const proof = await createSensitiveActionProof();
      await apiFetch('/account', {
        method: 'DELETE',
        headers: { 'x-reauth-token': proof.proofToken },
        body: JSON.stringify({ password })
      });
      clearTrustedDeviceToken();
      clearSession();
      window.location.replace('/login?accountDeleted=1');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.');
      setBusy(null);
    }
  }

  if (loading || !user) {
    return <main className="shell"><p>Chargement de tes droits sur les données...</p></main>;
  }

  return (
    <main className="shell" style={{maxWidth:820,margin:'0 auto'}}>
      <header style={{marginBottom:24}}>
        <small style={{color:'var(--mint)'}}>CONFIDENTIALITÉ & CONTRÔLE</small>
        <h1 style={{marginBottom:8}}>Tes données KnowMe</h1>
        <p style={{color:'var(--muted)',maxWidth:680}}>
          Exporte une copie des données liées à ton compte ou demande sa suppression. Ces actions sensibles exigent une nouvelle vérification de ton identité.
        </p>
      </header>

      <section className="card grid" style={{padding:24,marginBottom:18}}>
        <div>
          <h2 style={{marginTop:0}}>Vérification de sécurité</h2>
          <p style={{color:'var(--muted)'}}>
            Saisis ton mot de passe. Si la double authentification est active, ajoute aussi ton code 2FA ou un code de récupération.
          </p>
        </div>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          placeholder="Mot de passe actuel"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          maxLength={200}
          required
        />
        <input
          className="input"
          autoComplete="one-time-code"
          placeholder="Code 2FA (si activé)"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={14}
        />
      </section>

      <form className="card grid" onSubmit={exportAccount} style={{padding:24,marginBottom:18}}>
        <div>
          <h2 style={{marginTop:0}}>Exporter mes données</h2>
          <p style={{color:'var(--muted)'}}>
            KnowMe génère un fichier JSON à partir de l’export autoritatif du compte, y compris les données Nexus Social prévues par le contrat serveur.
          </p>
        </div>
        <button className="btn btn-primary" disabled={busy !== null || password.length < 8}>
          {busy === 'export' ? 'Préparation de l’export...' : 'Télécharger mon export'}
        </button>
      </form>

      <form className="card grid" onSubmit={deleteAccount} style={{padding:24,border:'1px solid rgba(255,120,120,.35)'}}>
        <div>
          <small style={{color:'var(--orange)'}}>ACTION IRRÉVERSIBLE</small>
          <h2>Supprimer mon compte</h2>
          <p style={{color:'var(--muted)'}}>
            Cette action utilise la procédure de suppression autoritative du serveur. Une fois acceptée, la session locale et la confiance accordée à cet appareil sont retirées immédiatement.
          </p>
        </div>
        <label className="grid" style={{gap:8}}>
          <span>Écris <strong>SUPPRIMER</strong> pour confirmer.</span>
          <input
            className="input"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="SUPPRIMER"
            autoComplete="off"
          />
        </label>
        <button
          className="btn"
          disabled={busy !== null || password.length < 8 || confirmation !== 'SUPPRIMER'}
        >
          {busy === 'delete' ? 'Suppression en cours...' : 'Supprimer définitivement mon compte'}
        </button>
      </form>

      {message && <p role="status" style={{color:'var(--orange)',marginTop:18}}>{message}</p>}

      <p style={{marginTop:24}}>
        <Link href="/dashboard" style={{color:'var(--mint)'}}>← Retour au tableau de bord</Link>
      </p>
    </main>
  );
}

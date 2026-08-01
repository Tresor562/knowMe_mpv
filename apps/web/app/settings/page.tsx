'use client';

import { FormEvent, useState } from 'react';
import { apiFetch, clearSession } from '../../lib/api';
import { useSession } from '../../lib/use-session';

export default function SettingsPage() {
  const { user, loading } = useSession({ required: true });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    try {
      const data = await apiFetch<unknown>('/account/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `knowme-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Ton export a été généré.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Export impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    if (!window.confirm('Cette action est définitive. Supprimer ton compte KnowMe ?')) return;

    setBusy(true);
    try {
      await apiFetch('/account', { method: 'DELETE', body: JSON.stringify({ password }) });
      clearSession();
      window.location.replace('/');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.');
      setBusy(false);
    }
  }

  if (loading || !user) return <main className="shell"><p>Chargement des paramètres…</p></main>;

  return (
    <main className="shell" style={{maxWidth:820,margin:'0 auto'}}>
      <header><small style={{color:'var(--mint)'}}>CONFIDENTIALITÉ ET COMPTE</small><h1>Paramètres</h1><p style={{color:'var(--muted)'}}>Compte de {user.displayName} (@{user.username})</p></header>
      {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}

      <section className="card" style={{padding:24,marginBottom:20}}>
        <h2>Exporter mes données</h2>
        <p style={{color:'var(--muted)',lineHeight:1.6}}>Télécharge une copie JSON de ton profil, de tes publications, de tes défis, de tes relations et de tes autres données KnowMe.</p>
        <button className="btn btn-primary" onClick={exportData} disabled={busy}>{busy ? 'Préparation…' : 'Télécharger mon export'}</button>
      </section>

      <section className="card" style={{padding:24,border:'1px solid rgba(255,120,80,.35)'}}>
        <h2>Supprimer mon compte</h2>
        <p style={{color:'var(--muted)',lineHeight:1.6}}>La suppression est définitive. Tes sessions seront révoquées et tes données seront supprimées selon les règles du service.</p>
        <form onSubmit={deleteAccount} style={{display:'grid',gap:12}}>
          <input className="input" type="password" name="password" placeholder="Confirme ton mot de passe" minLength={8} required />
          <button className="btn btn-accent" disabled={busy}>Supprimer définitivement mon compte</button>
        </form>
      </section>
    </main>
  );
}

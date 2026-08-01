'use client';

import { FormEvent, useState } from 'react';

export default function SettingsPage() {
  const [message, setMessage] = useState('');

  async function exportData() {
    const token = localStorage.getItem('knowme_token');

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/account/export`,
      {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {}
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message ?? 'Export impossible.');
      return;
    }

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `knowme-export-${new Date().toISOString()}.json`;
    link.click();

    URL.revokeObjectURL(url);
    setMessage('Export généré.');
  }

  async function deleteAccount(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const confirmed = window.confirm(
      'Cette action supprimera définitivement ton compte.'
    );

    if (!confirmed) return;

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const token = localStorage.getItem('knowme_token');

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/account`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {})
        },
        body: JSON.stringify({ password })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message ?? 'Suppression impossible.');
      return;
    }

    localStorage.removeItem('knowme_token');
    localStorage.removeItem('knowme_refresh_token');
    window.location.href = '/';
  }

  return (
    <main className="shell" style={{maxWidth:760,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--mint)'}}>CONFIDENTIALITÉ</small>
        <h1>Paramètres du compte</h1>
      </header>

      {message && <p>{message}</p>}

      <section className="card" style={{padding:22}}>
        <h2>Exporter mes données</h2>
        <p style={{color:'var(--muted)'}}>
          Télécharge une copie JSON des informations associées à ton compte.
        </p>
        <button
          className="btn btn-primary"
          onClick={exportData}
        >
          Télécharger mes données
        </button>
      </section>

      <form
        className="card grid"
        onSubmit={deleteAccount}
        style={{padding:22,marginTop:20,borderColor:'rgba(255,138,61,.45)'}}
      >
        <h2>Supprimer mon compte</h2>
        <p style={{color:'var(--muted)'}}>
          Cette action est définitive.
        </p>
        <input
          className="input"
          type="password"
          name="password"
          placeholder="Confirme ton mot de passe"
          minLength={8}
          required
        />
        <button className="btn btn-accent">
          Supprimer définitivement
        </button>
      </form>
    </main>
  );
}

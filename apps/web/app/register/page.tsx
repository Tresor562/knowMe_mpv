'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { apiFetch, saveSession } from '../../lib/api';

type RegisterResult = {
  accessToken: string;
  refreshToken?: string;
};

export default function RegisterPage() {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    const form = new FormData(event.currentTarget);

    try {
      const data = await apiFetch<RegisterResult>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          displayName: String(form.get('displayName') ?? '').trim(),
          username: String(form.get('username') ?? '').trim(),
          email: String(form.get('email') ?? '').trim(),
          password: String(form.get('password') ?? '')
        })
      });

      saveSession(data.accessToken, data.refreshToken);
      window.location.replace('/dashboard');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Inscription impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell" style={{display:'grid',placeItems:'center'}}>
      <form className="card grid" onSubmit={submit} style={{width:'min(100%,500px)',padding:28}}>
        <div>
          <small style={{color:'var(--mint)'}}>REJOINS KNOWME</small>
          <h1>Créer ton profil</h1>
          <p style={{color:'var(--muted)'}}>Commence à découvrir qui te connaît vraiment.</p>
        </div>
        <input className="input" name="displayName" placeholder="Nom affiché" autoComplete="name" minLength={2} required />
        <input className="input" name="username" placeholder="Pseudo" autoComplete="username" minLength={3} required />
        <input className="input" type="email" name="email" placeholder="Email" autoComplete="email" required />
        <input className="input" type="password" name="password" placeholder="Mot de passe sécurisé" autoComplete="new-password" minLength={8} required />
        <button className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Création...' : 'Commencer'}
        </button>
        {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}
        <p style={{color:'var(--muted)',textAlign:'center'}}>
          Déjà inscrit ? <Link href="/login" style={{color:'var(--mint)'}}>Se connecter</Link>
        </p>
      </form>
    </main>
  );
}

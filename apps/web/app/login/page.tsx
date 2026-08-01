'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { apiFetch, saveSession } from '../../lib/api';

type LoginResult = {
  accessToken: string;
  refreshToken?: string;
};

export default function LoginPage() {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    const form = new FormData(event.currentTarget);

    try {
      const data = await apiFetch<LoginResult>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: String(form.get('identifier') ?? '').trim(),
          password: String(form.get('password') ?? '')
        })
      });

      saveSession(data.accessToken, data.refreshToken);
      window.location.replace('/dashboard');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Connexion impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell" style={{display:'grid',placeItems:'center'}}>
      <form className="card grid" onSubmit={submit} style={{width:'min(100%,430px)',padding:28}}>
        <div>
          <small style={{color:'var(--mint)'}}>BON RETOUR</small>
          <h1>Connexion</h1>
          <p style={{color:'var(--muted)'}}>Retrouve tes défis, tes amis et tes conversations.</p>
        </div>
        <input className="input" name="identifier" placeholder="Email ou pseudo" autoComplete="username" required />
        <input className="input" name="password" type="password" placeholder="Mot de passe" autoComplete="current-password" minLength={8} required />
        <button className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Connexion...' : 'Entrer dans KnowMe'}
        </button>
        {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}
        <p style={{color:'var(--muted)',textAlign:'center'}}>
          Pas encore de compte ? <Link href="/register" style={{color:'var(--mint)'}}>Créer mon profil</Link>
        </p>
      </form>
    </main>
  );
}

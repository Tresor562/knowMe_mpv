'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');

    if (password !== confirmation) {
      setSubmitting(false);
      setMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    try {
      await apiFetch('/auth/password-reset', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
      setDone(true);
      setMessage('Ton mot de passe a été modifié. Toutes les anciennes sessions et tous les appareils de confiance ont été révoqués.');
    } catch {
      setMessage('Ce lien est invalide, expiré ou a déjà été utilisé. Demande un nouveau lien de récupération.');
    } finally {
      setSubmitting(false);
    }
  }

  if (token === null) {
    return (
      <main className="shell" style={{display:'grid',placeItems:'center'}}>
        <section className="card" aria-busy="true" style={{width:'min(100%,430px)',padding:28}}>
          <p style={{color:'var(--muted)'}}>Vérification du lien de récupération…</p>
        </section>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="shell" style={{display:'grid',placeItems:'center'}}>
        <section className="card grid" style={{width:'min(100%,430px)',padding:28}}>
          <h1>Lien de récupération invalide</h1>
          <p style={{color:'var(--muted)'}}>Le lien ne contient aucun jeton de récupération.</p>
          <Link className="btn btn-primary" href="/forgot-password">Demander un nouveau lien</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell" style={{display:'grid',placeItems:'center'}}>
      <form className="card grid" onSubmit={submit} style={{width:'min(100%,430px)',padding:28}}>
        <div>
          <small style={{color:'var(--mint)'}}>SÉCURITÉ DU COMPTE</small>
          <h1>Nouveau mot de passe</h1>
          <p style={{color:'var(--muted)'}}>Choisis un nouveau mot de passe d’au moins 12 caractères. La réinitialisation déconnectera les anciennes sessions.</p>
        </div>
        {!done && (
          <>
            <input className="input" name="password" type="password" placeholder="Nouveau mot de passe" autoComplete="new-password" minLength={12} required />
            <input className="input" name="confirmation" type="password" placeholder="Confirme le mot de passe" autoComplete="new-password" minLength={12} required />
            <button className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Sécurisation...' : 'Réinitialiser le mot de passe'}
            </button>
          </>
        )}
        {message && <p role="status" style={{color:done?'var(--mint)':'var(--orange)'}}>{message}</p>}
        <p style={{color:'var(--muted)',textAlign:'center'}}>
          <Link href={done ? '/login' : '/forgot-password'} style={{color:'var(--mint)'}}>
            {done ? 'Se connecter' : 'Demander un nouveau lien'}
          </Link>
        </p>
      </form>
    </main>
  );
}

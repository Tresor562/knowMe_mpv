'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { apiFetch } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    const form = new FormData(event.currentTarget);

    try {
      await apiFetch('/auth/password-recovery', {
        method: 'POST',
        body: JSON.stringify({ email: String(form.get('email') ?? '').trim() })
      });
      setMessage('Si un compte correspond à cette adresse, un lien de récupération sera envoyé. Vérifie aussi les courriers indésirables.');
    } catch {
      setMessage('La récupération de compte est temporairement indisponible. Réessaie plus tard.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell" style={{display:'grid',placeItems:'center'}}>
      <form className="card grid" onSubmit={submit} style={{width:'min(100%,430px)',padding:28}}>
        <div>
          <small style={{color:'var(--mint)'}}>RÉCUPÉRATION DE COMPTE</small>
          <h1>Mot de passe oublié</h1>
          <p style={{color:'var(--muted)'}}>Entre l’adresse e-mail de ton compte KnowMe. Pour protéger ta vie privée, la réponse sera la même qu’un compte existe ou non.</p>
        </div>
        <input className="input" name="email" type="email" placeholder="Adresse e-mail" autoComplete="email" required />
        <button className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Envoi...' : 'Recevoir un lien de récupération'}
        </button>
        {message && <p role="status" style={{color:'var(--muted)'}}>{message}</p>}
        <p style={{color:'var(--muted)',textAlign:'center'}}>
          <Link href="/login" style={{color:'var(--mint)'}}>Retour à la connexion</Link>
        </p>
      </form>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { KnowMeBrand } from '../../components/knowme-brand';
import { apiFetch, type ApiError } from '../../lib/api';

type RecoveryState = 'idle' | 'sent' | 'unavailable' | 'rate-limited' | 'failed';

export default function ForgotPasswordPage() {
  const [state, setState] = useState<RecoveryState>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setState('idle');
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch<{ accepted: true }>('/auth/password-recovery', {
        method: 'POST',
        body: JSON.stringify({ email: String(form.get('email') ?? '').trim() })
      });
      setState('sent');
      setMessage('Si un compte correspond à cette adresse, un lien de récupération sera envoyé. Pensez à vérifier vos courriers indésirables.');
    } catch (cause) {
      const error = cause as ApiError;
      if (error.status === 503 || error.status === 502 || error.status === 504) {
        setState('unavailable');
        setMessage('Le service d’envoi des liens de récupération est actuellement indisponible côté serveur. Aucun lien n’a été envoyé. Vous pouvez toujours revenir à la connexion.');
      } else if (error.status === 429) {
        setState('rate-limited');
        setMessage('Trop de demandes de récupération. Attendez avant de réessayer.');
      } else {
        setState('failed');
        setMessage(cause instanceof Error ? cause.message : 'Impossible de traiter la demande actuellement.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="km-auth">
      <section className="km-auth-intro">
        <KnowMeBrand />
        <div className="km-auth-visual">
          <h2>Votre compte.<br/><span>Vos conversations.</span></h2>
          <p>La récupération protège votre identité. Votre mot de passe ne sera jamais demandé par l’équipe KnowMe.</p>
        </div>
        <span className="km-auth-pill">Une récupération confidentielle</span>
      </section>
      <section className="km-auth-panel" aria-label="Récupération de votre compte KnowMe">
        <form onSubmit={submit}>
          <h1>Mot de passe oublié ?</h1>
          <p className="km-auth-subtitle">Indiquez l’adresse e-mail de votre compte pour recevoir un lien de réinitialisation.</p>
          <div className="km-auth-fields">
            <label className="km-auth-field">
              <span>Adresse e-mail</span>
              <input name="email" type="email" placeholder="vous@exemple.com" autoComplete="email" required maxLength={254}/>
            </label>
          </div>
          <button type="submit" className="km-auth-submit" disabled={submitting || state === 'sent'}>
            {submitting && <span className="km-spinner" aria-hidden="true" />}
            {submitting ? 'Vérification en cours…' : state === 'sent' ? 'Demande reçue' : 'Recevoir un lien'}
          </button>
          {message && <div className={state === 'sent' ? 'km-recovery-success' : 'km-auth-error'} role="status">{message}</div>}
          <p className="km-auth-alternate"><Link href="/login">← Retour à la connexion</Link></p>
        </form>
      </section>
    </main>
  );
}

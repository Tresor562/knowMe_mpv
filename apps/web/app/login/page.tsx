'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import {
  apiFetch,
  getTrustedDeviceToken,
  saveSession,
  saveTrustedDeviceToken
} from '../../lib/api';

type SessionResult = {
  accessToken: string;
  refreshToken?: string;
  trustedDeviceToken?: string;
};

type ChallengeResult = {
  requiresTwoFactor: true;
  challengeToken: string;
  expiresAt: string;
  expiresIn: number;
};

type LoginResult = SessionResult | ChallengeResult;

function isChallenge(result: LoginResult): result is ChallengeResult {
  return 'requiresTwoFactor' in result && result.requiresTwoFactor;
}

export default function LoginPage() {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [challengeToken, setChallengeToken] = useState('');
  const [secondFactorCode, setSecondFactorCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);

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
          password: String(form.get('password') ?? ''),
          deviceToken: getTrustedDeviceToken() ?? undefined
        })
      });

      if (isChallenge(data)) {
        setChallengeToken(data.challengeToken);
        setMessage('Entre le code de ton application d’authentification ou un code de récupération.');
        return;
      }

      saveSession(data.accessToken, data.refreshToken);
      window.location.replace('/dashboard');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Connexion impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifySecondFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const data = await apiFetch<SessionResult>('/auth/login/2fa', {
        method: 'POST',
        body: JSON.stringify({
          challengeToken,
          code: secondFactorCode.trim().toUpperCase(),
          trustDevice,
          deviceLabel: 'Navigateur Web',
          platform: 'WEB'
        })
      });

      saveSession(data.accessToken, data.refreshToken);
      if (data.trustedDeviceToken) {
        saveTrustedDeviceToken(data.trustedDeviceToken);
      }
      window.location.replace('/dashboard');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Code de sécurité invalide.');
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setChallengeToken('');
    setSecondFactorCode('');
    setTrustDevice(false);
    setMessage('');
  }

  return (
    <main className="shell" style={{display:'grid',placeItems:'center'}}>
      {!challengeToken ? (
        <form className="card grid" onSubmit={submit} style={{width:'min(100%,430px)',padding:28}}>
          <div>
            <small style={{color:'var(--mint)'}}>BON RETOUR</small>
            <h1>Connexion</h1>
            <p style={{color:'var(--muted)'}}>Retrouve tes défis, tes amis et tes conversations.</p>
          </div>
          <input className="input" name="identifier" placeholder="Email ou pseudo" autoComplete="username" required />
          <input className="input" name="password" type="password" placeholder="Mot de passe" autoComplete="current-password" minLength={8} required />
          <p style={{margin:0,textAlign:'right'}}>
            <Link href="/forgot-password" style={{color:'var(--mint)'}}>Mot de passe oublié ?</Link>
          </p>
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Vérification...' : 'Entrer dans KnowMe'}
          </button>
          {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}
          <p style={{color:'var(--muted)',textAlign:'center'}}>
            Pas encore de compte ? <Link href="/register" style={{color:'var(--mint)'}}>Créer mon profil</Link>
          </p>
        </form>
      ) : (
        <form className="card grid" onSubmit={verifySecondFactor} style={{width:'min(100%,430px)',padding:28}}>
          <div>
            <small style={{color:'var(--mint)'}}>DEUXIÈME PREUVE</small>
            <h1>Vérification de sécurité</h1>
            <p style={{color:'var(--muted)'}}>Le mot de passe a été accepté. Aucun accès n’est accordé avant cette seconde vérification.</p>
          </div>
          <input
            className="input"
            value={secondFactorCode}
            onChange={(event) => setSecondFactorCode(event.target.value)}
            placeholder="123456 ou XXXX-XXXX"
            autoComplete="one-time-code"
            inputMode="text"
            minLength={6}
            maxLength={14}
            required
          />
          <label style={{display:'flex',gap:10,alignItems:'flex-start'}}>
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(event) => setTrustDevice(event.target.checked)}
            />
            <span>Faire confiance à cet appareil pendant 30 jours. Cette autorisation reste révocable depuis la page Sécurité.</span>
          </label>
          <button className="btn btn-primary" disabled={submitting || secondFactorCode.trim().length < 6}>
            {submitting ? 'Validation...' : 'Valider et ouvrir la session'}
          </button>
          <button className="btn" type="button" onClick={restart} disabled={submitting}>
            Recommencer la connexion
          </button>
          {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}
        </form>
      )}
    </main>
  );
}

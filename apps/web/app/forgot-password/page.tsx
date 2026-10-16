'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { KnowMeBrand } from '../../components/knowme-brand';
import { apiFetch, type ApiError } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await apiFetch('/auth/password-recovery/code', {
        method: 'POST', body: JSON.stringify({ email: email.trim() })
      });
      setSent(true);
      setMessage('Si un compte correspond à cette adresse, un code à 6 chiffres lui sera envoyé. Vérifie également les spams.');
    } catch (error) {
      const cause = error as ApiError;
      setMessage(cause.status === 429 ? 'Trop de demandes. Réessaie dans quelques minutes.' : cause.message);
    } finally { setBusy(false); }
  }

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    if (password !== confirm) { setMessage('Les mots de passe ne correspondent pas.'); return; }
    setBusy(true);
    try {
      await apiFetch('/auth/password-reset/code', {
        method: 'POST', body: JSON.stringify({ email: email.trim(), code: code.trim(), password })
      });
      setDone(true);
      setMessage('Mot de passe changé. Toutes tes anciennes sessions ont été fermées.');
    } catch (error) {
      const cause = error as ApiError;
      setMessage(cause.status === 401 ? 'Code invalide, expiré ou déjà utilisé.' : cause.message);
    } finally { setBusy(false); }
  }

  return <main className="km-auth">
    <section className="km-auth-intro">
      <KnowMeBrand />
      <div className="km-auth-visual">
        <h2>Votre compte.<br/><span>Vos conversations.</span></h2>
        <p>Récupérez votre compte avec un code temporaire envoyé à votre adresse email.</p>
      </div>
      <span className="km-auth-pill">Récupération sécurisée</span>
    </section>
    <section className="km-auth-panel">
      {!sent ? <form onSubmit={requestCode}>
        <h1>Mot de passe oublié ?</h1>
        <p className="km-auth-subtitle">Nous vous envoyons un code à 6 chiffres pour choisir un nouveau mot de passe.</p>
        <label className="km-auth-field"><span>Adresse email</span>
          <input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required placeholder="vous@exemple.com" />
        </label>
        <button className="km-auth-submit" disabled={busy}>{busy?'Envoi…':'Recevoir mon code'}</button>
      </form> : !done ? <form onSubmit={reset}>
        <h1>Saisissez votre code</h1>
        <p className="km-auth-subtitle">Code envoyé si l'adresse existe : {email}. Il expire dans 10 minutes.</p>
        <div className="km-auth-fields">
          <label className="km-auth-field"><span>Code à 6 chiffres</span>
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required placeholder="000000" />
          </label>
          <label className="km-auth-field"><span>Nouveau mot de passe</span>
            <input type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} required />
          </label>
          <label className="km-auth-field"><span>Confirmer le mot de passe</span>
            <input type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)} required />
          </label>
        </div>
        <button className="km-auth-submit" disabled={busy || code.length !== 6}>{busy?'Vérification…':'Réinitialiser mon mot de passe'}</button>
        <button type="button" className="btn" style={{width:'100%',marginTop:12}} disabled={busy} onClick={()=>{setSent(false);setMessage('');setCode('');}}>Renvoyer un code</button>
      </form> : <div>
        <h1>Mot de passe modifié</h1>
        <p>Tu peux te reconnecter avec ton nouveau mot de passe.</p>
        <Link href="/login" className="km-auth-submit" style={{display:'block',textAlign:'center'}}>Se connecter</Link>
      </div>}
      {message && <p className={done || sent ? 'km-recovery-success' : 'km-auth-error'} role="status">{message}</p>}
      {!done && <p className="km-auth-alternate"><Link href="/login">← Retour à la connexion</Link></p>}
    </section>
  </main>;
}

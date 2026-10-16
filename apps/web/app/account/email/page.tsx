'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, type ApiError } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Status = { email: string; verified: boolean; verifiedAt: string | null };
export default function EmailSettingsPage() {
  const { user, loading } = useSession({ required: true });
  const [status, setStatus] = useState<Status | null>(null);
  const [nextEmail, setNextEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'request'|'confirm'>('request');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) void apiFetch<Status>('/auth/email/status').then(setStatus).catch(()=>setMessage('Impossible de charger le statut de ton adresse email.'));
  }, [user]);

  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await apiFetch('/auth/email/change/request', {
        method: 'POST', body: JSON.stringify({ newEmail: nextEmail.trim(), password })
      });
      setStep('confirm'); setPassword('');
      setMessage('Un code a été envoyé à la nouvelle adresse. Il expire dans 10 minutes.');
    } catch (error) { setMessage((error as ApiError).message); }
    finally { setBusy(false); }
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const data = await apiFetch<{changed:true;email:string}>('/auth/email/change/confirm', {
        method: 'POST', body: JSON.stringify({ code })
      });
      setStatus({ email:data.email, verified:true, verifiedAt:new Date().toISOString() });
      setStep('request'); setCode(''); setNextEmail('');
      setMessage('Adresse email modifiée et confirmée.');
    } catch (error) { setMessage((error as ApiError).message); }
    finally { setBusy(false); }
  }
  if (loading || !user) return <main className="shell"><p>Chargement…</p></main>;
  return <main className="shell km-settings-page">
    <header className="km-settings-header">
      <Link href="/settings" className="km-settings-back" aria-label="Retour aux paramètres">‹</Link>
      <div><h1>Adresse email</h1><p>Compte et sécurité</p></div>
    </header>
    <section className="km-settings-group">
      <h2>Adresse actuelle</h2>
      <p>{status?.email || 'Chargement…'}</p>
      <p>{status?.verified ? 'Adresse confirmée' : 'Adresse non confirmée'}</p>
    </section>
    <section className="km-settings-group">
      <h2>{step==='request'?'Changer mon adresse email':'Confirmer la nouvelle adresse'}</h2>
      {step==='request' ? <form className="km-settings-disclosure-body" onSubmit={request}>
        <label className="km-auth-field"><span>Nouvelle adresse email</span>
          <input type="email" maxLength={254} autoComplete="email" value={nextEmail} onChange={e=>setNextEmail(e.target.value)} required />
        </label>
        <label className="km-auth-field"><span>Mot de passe actuel</span>
          <input type="password" minLength={8} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy?'Envoi…':'Recevoir un code'}</button>
      </form> : <form className="km-settings-disclosure-body" onSubmit={confirm}>
        <p>Un code a été envoyé à {nextEmail}.</p>
        <label className="km-auth-field"><span>Code reçu</span>
          <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required />
        </label>
        <button className="btn btn-primary" disabled={busy || code.length!==6}>Confirmer la nouvelle adresse</button>
        <button type="button" className="btn" onClick={()=>setStep('request')} disabled={busy}>Modifier l'adresse</button>
      </form>}
      {message && <p role="status">{message}</p>}
    </section>
  </main>;
}

'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { KnowMeBrand } from '../../components/knowme-brand';
import { apiFetch, saveSession, type ApiError } from '../../lib/api';

type VerifiedSession = { accessToken: string; refreshToken?: string };
export default function VerifyEmailPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { setEmail(window.sessionStorage.getItem('knowme_pending_email') || ''); }, []);
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await apiFetch<VerifiedSession>('/auth/email/confirm', {
        method: 'POST', body: JSON.stringify({ email: email.trim(), code })
      });
      saveSession(result.accessToken, result.refreshToken);
      window.sessionStorage.removeItem('knowme_pending_email');
      window.location.replace('/messages');
    } catch (error) {
      const cause = error as ApiError;
      setMessage(cause.status === 401 ? 'Ce code est invalide, expiré ou déjà utilisé.' : cause.message);
    } finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setMessage('');
    try {
      await apiFetch('/auth/email/resend', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setMessage('Si cette adresse attend une confirmation, un nouveau code lui sera envoyé.');
    } catch (error) {
      setMessage((error as ApiError).status === 429 ? 'Patiente une minute avant un nouveau code.' : (error as Error).message);
    } finally { setBusy(false); }
  }
  return <main className="km-auth">
    <section className="km-auth-intro">
      <KnowMeBrand />
      <div className="km-auth-visual"><h2>Une adresse.<br/><span>Votre identité.</span></h2>
        <p>Vérifiez votre boîte de réception pour activer votre compte KnowMe.</p>
      </div>
      <span className="km-auth-pill">Code valable 10 minutes</span>
    </section>
    <section className="km-auth-panel">
      <form onSubmit={verify}>
        <h1>Confirme ton adresse email</h1>
        <p className="km-auth-subtitle">Saisis le code de 6 chiffres reçu par email.</p>
        <div className="km-auth-fields">
          <label className="km-auth-field"><span>Adresse email</span>
            <input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254}/>
          </label>
          <label className="km-auth-field"><span>Code de confirmation</span>
            <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code}
              onChange={e=>setCode(e.target.value.replace(/\D/g,''))} pattern="[0-9]{6}" maxLength={6} placeholder="000000" required />
          </label>
        </div>
        <button className="km-auth-submit" disabled={busy || code.length !== 6}>{busy?'Vérification…':'Confirmer mon adresse'}</button>
      </form>
      <button type="button" className="btn" disabled={busy || !email.includes('@')} style={{width:'100%',marginTop:14}} onClick={()=>void resend()}>Renvoyer un code</button>
      {message && <p role="status" className="km-auth-error">{message}</p>}
      <p className="km-auth-alternate"><Link href="/login">Retour à la connexion</Link></p>
    </section>
  </main>;
}

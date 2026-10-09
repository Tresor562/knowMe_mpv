'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { KnowMeBrand } from '../../components/knowme-brand';
import { apiFetch, saveSession } from '../../lib/api';

type RegisterResult={accessToken:string;refreshToken?:string};
export default function RegisterPage(){
  const [message,setMessage]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [showPassword,setShowPassword]=useState(false);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSubmitting(true);setMessage('');
    const form=new FormData(event.currentTarget);
    try {
      const data=await apiFetch<RegisterResult>('/auth/register',{method:'POST',body:JSON.stringify({
        displayName:String(form.get('displayName')??'').trim(),
        username:String(form.get('username')??'').trim(),
        email:String(form.get('email')??'').trim(),
        password:String(form.get('password')??'')
      })});
      saveSession(data.accessToken,data.refreshToken);
      window.location.replace('/messages');
    }catch(cause){setMessage(cause instanceof Error?cause.message:'Inscription impossible pour le moment.');}
    finally{setSubmitting(false);}
  }

  return <main className="km-auth">
    <section className="km-auth-intro">
      <KnowMeBrand />
      <div className="km-auth-visual">
        <h2>Votre espace.<br/><span>À votre image.</span></h2>
        <p>Une messagerie pour parler librement, créer des liens et rester proche de ceux qui comptent.</p>
      </div>
      <span className="km-auth-pill">Bienvenue dans KnowMe</span>
    </section>
    <section className="km-auth-panel" aria-label="Inscription à KnowMe">
      <form onSubmit={submit}>
        <h1>Créer votre compte</h1>
        <p className="km-auth-subtitle">Quelques informations pour commencer.</p>
        <div className="km-auth-fields">
          <label className="km-auth-field"><span>Votre nom</span><input name="displayName" placeholder="Nom affiché" autoComplete="name" minLength={2} required/></label>
          <label className="km-auth-field"><span>Nom d'utilisateur</span><input name="username" placeholder="Votre pseudo" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} required/></label>
          <label className="km-auth-field"><span>Adresse e-mail</span><input name="email" type="email" placeholder="vous@exemple.com" autoComplete="email" required/></label>
          <label className="km-auth-field"><span>Mot de passe</span><span className="km-input-wrap">
            <input name="password" type={showPassword?'text':'password'} placeholder="Au moins 8 caractères" autoComplete="new-password" minLength={8} required/>
            <button className="km-icon-button" type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Masquer le mot de passe':'Afficher le mot de passe'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>{showPassword&&<path d="M4 4 20 20"/>}</svg>
            </button>
          </span></label>
        </div>
        <button className="km-auth-submit" disabled={submitting}>{submitting&&<span className="km-spinner" aria-hidden="true"/>}{submitting?'Création en cours…':'Créer mon compte'}</button>
        {message&&<p className="km-auth-error" role="alert">{message}</p>}
        <p className="km-auth-alternate">Déjà un compte ? <Link href="/login">Se connecter</Link></p>
      </form>
    </section>
  </main>;
}

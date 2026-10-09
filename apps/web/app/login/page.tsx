'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { KnowMeBrand } from '../../components/knowme-brand';
import { apiFetch, getTrustedDeviceToken, saveSession, saveTrustedDeviceToken } from '../../lib/api';

type SessionResult = { accessToken: string; refreshToken?: string; trustedDeviceToken?: string };
type ChallengeResult = { requiresTwoFactor: true; challengeToken: string; expiresAt: string; expiresIn: number };
type LoginResult = SessionResult | ChallengeResult;
function isChallenge(result: LoginResult): result is ChallengeResult {
  return 'requiresTwoFactor' in result && result.requiresTwoFactor;
}
function EyeIcon({ hidden }: {hidden:boolean}) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6S2.5 12 2.5 12Z"/>
    <circle cx="12" cy="12" r="2.8"/>
    {hidden && <path d="M4 4 20 20"/>}
  </svg>;
}
export default function LoginPage() {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [challengeToken, setChallengeToken] = useState('');
  const [secondFactorCode, setSecondFactorCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setMessage('');
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
      if(isChallenge(data)){
        setChallengeToken(data.challengeToken);
        setMessage('');
        return;
      }
      saveSession(data.accessToken,data.refreshToken);
      window.location.replace('/messages');
    }catch(cause){
      setMessage(cause instanceof Error ? cause.message : 'Impossible de se connecter pour le moment.');
    }finally{setSubmitting(false);}
  }

  async function verifySecondFactor(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSubmitting(true);setMessage('');
    try {
      const data=await apiFetch<SessionResult>('/auth/login/2fa',{
        method:'POST',
        body:JSON.stringify({challengeToken,code:secondFactorCode.trim().toUpperCase(),trustDevice,deviceLabel:'Navigateur Web',platform:'WEB'})
      });
      saveSession(data.accessToken,data.refreshToken);
      if(data.trustedDeviceToken)saveTrustedDeviceToken(data.trustedDeviceToken);
      window.location.replace('/messages');
    }catch(cause){
      setMessage(cause instanceof Error ? cause.message : 'Code de sécurité invalide.');
    }finally{setSubmitting(false);}
  }

  return <main className="km-auth">
    <section className="km-auth-intro">
      <KnowMeBrand />
      <div className="km-auth-visual">
        <h2>Vos échanges.<br/><span>Votre univers.</span></h2>
        <p>Discutez avec vos proches, partagez vos moments et retrouvez vos communautés dans un espace qui vous ressemble.</p>
      </div>
      <span className="km-auth-pill">Une expérience plus personnelle</span>
    </section>
    <section className="km-auth-panel" aria-label="Connexion à KnowMe">
      {!challengeToken ? <form onSubmit={submit}>
        <h1>Bon retour</h1>
        <p className="km-auth-subtitle">Connectez-vous pour retrouver vos conversations.</p>
        <div className="km-auth-fields">
          <label className="km-auth-field"><span>Identifiant ou adresse e-mail</span>
            <input name="identifier" type="text" placeholder="Votre identifiant" autoComplete="username" autoCapitalize="none" spellCheck={false} required/>
          </label>
          <label className="km-auth-field"><span>Mot de passe</span>
            <span className="km-input-wrap">
              <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Votre mot de passe" autoComplete="current-password" minLength={8} required/>
              <button className="km-icon-button" type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={showPassword}>
                <EyeIcon hidden={showPassword}/>
              </button>
            </span>
          </label>
        </div>
        <div className="km-auth-meta"><Link href="/forgot-password">Mot de passe oublié ?</Link></div>
        <button className="km-auth-submit" disabled={submitting} type="submit">
          {submitting && <span className="km-spinner" aria-hidden="true"/>}
          {submitting ? 'Connexion en cours…' : 'Se connecter'}
        </button>
        {message && <p className="km-auth-error" role="alert">{message}</p>}
        <p className="km-auth-alternate">Nouveau sur KnowMe ? <Link href="/register">Créer un compte</Link></p>
      </form> : <form onSubmit={verifySecondFactor}>
        <h1>Vérification</h1>
        <p className="km-auth-subtitle">Saisissez le code de votre application d'authentification ou un code de récupération.</p>
        <label className="km-auth-field"><span>Code de sécurité</span><input value={secondFactorCode} onChange={event=>setSecondFactorCode(event.target.value)} placeholder="123456 ou XXXX-XXXX" autoComplete="one-time-code" minLength={6} maxLength={14} required/></label>
        <label style={{display:'flex',alignItems:'center',gap:11,marginTop:18,fontSize:13,color:'var(--muted)'}}>
          <input type="checkbox" checked={trustDevice} onChange={event=>setTrustDevice(event.target.checked)} style={{width:18,height:18,flexShrink:0}}/>
          Faire confiance à cet appareil pendant 30 jours.
        </label>
        <button className="km-auth-submit" disabled={submitting || secondFactorCode.trim().length<6}>
          {submitting && <span className="km-spinner" aria-hidden="true"/>}
          {submitting ? 'Vérification…' : 'Valider la connexion'}
        </button>
        {message && <p className="km-auth-error" role="alert">{message}</p>}
        <button className="btn" style={{width:'100%',marginTop:12}} type="button" disabled={submitting} onClick={()=>{setChallengeToken('');setMessage('');setSecondFactorCode('');setTrustDevice(false);}}>Revenir à la connexion</button>
      </form>}
      <p className="km-auth-help" style={{textAlign:'center',margin:'24px 0 0'}}>Votre compte et vos conversations restent associés à votre profil KnowMe.</p>
    </section>
  </main>;
}

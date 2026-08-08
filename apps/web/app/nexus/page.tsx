'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Entitlement = {
  linked:boolean;
  plan:'free'|'plus'|'pro'|'business';
  status:'active'|'inactive';
  capabilities:{knowMePrivateChat:true;knowMeThink:boolean};
  knowMe:{hourlyTurns:number;maxContextMessages:number;maxReplyChars:number;modes:('instant'|'think')[]};
  verifiedAt:string;
};
type Conversation={id:string};

export default function NexusAccountPage(){
  const {loading}=useSession({required:true});
  const [entitlement,setEntitlement]=useState<Entitlement|null>(null);
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  const load=useCallback(async()=>{
    try{
      setEntitlement(await apiFetch<Entitlement>('/nexus-social/entitlement'));
      setMessage('');
    }catch(cause){setMessage(cause instanceof Error?cause.message:'Impossible de charger le profil Nexus.');}
  },[]);

  useEffect(()=>{if(!loading)void load();},[load,loading]);

  async function link(event:FormEvent){
    event.preventDefault();
    if(!code.trim()||busy)return;
    setBusy(true);
    try{
      const next=await apiFetch<Entitlement>('/nexus-social/account-link',{method:'POST',body:JSON.stringify({code:code.trim()})});
      setEntitlement(next);setCode('');setMessage('Compte Nexus connecté.');
    }catch(cause){setMessage(cause instanceof Error?cause.message:'Liaison impossible.');}
    finally{setBusy(false);}
  }

  async function unlink(){
    if(busy)return;setBusy(true);
    try{await apiFetch('/nexus-social/account-link',{method:'DELETE'});await load();setMessage('Compte Nexus déconnecté.');}
    catch(cause){setMessage(cause instanceof Error?cause.message:'Déconnexion impossible.');}
    finally{setBusy(false);}
  }

  async function chat(){
    if(busy)return;setBusy(true);
    try{const conversation=await apiFetch<Conversation>('/nexus-social/private-conversation',{method:'POST',body:'{}'});window.location.href=`/messages/${conversation.id}`;}
    catch(cause){setMessage(cause instanceof Error?cause.message:'Nexus est indisponible.');setBusy(false);}
  }

  if(loading)return <main className="shell">Chargement…</main>;
  const linked=entitlement?.linked===true;
  const label=linked?`Nexus ${entitlement.plan[0].toUpperCase()}${entitlement.plan.slice(1)}`:'KnowMe · Nexus gratuit';

  return(
    <main className="shell" style={{maxWidth:760,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <div><small style={{color:'var(--mint)'}}>NEXUS DANS KNOWME</small><h1>Compte Nexus</h1></div>
        <Link href="/messages" className="btn">Messages</Link>
      </header>

      <section className="card" style={{padding:20,display:'grid',gap:14}}>
        <div>
          <strong style={{fontSize:20}}>{label}</strong>
          <p style={{color:'var(--muted)',marginBottom:0}}>
            {linked
              ?'Ton abonnement est vérifié directement auprès de Nexus. KnowMe ne peut pas augmenter ton plan de lui-même.'
              :'Tu peux déjà parler gratuitement à Nexus dans KnowMe. Connecte ton compte Nexus pour débloquer les capacités et quotas associés à ton abonnement.'}
          </p>
        </div>
        {entitlement&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <span className="btn" style={{pointerEvents:'none'}}>Plan : {entitlement.plan.toUpperCase()}</span>
          <span className="btn" style={{pointerEvents:'none'}}>{entitlement.knowMe.hourlyTurns} réponses/h</span>
          <span className="btn" style={{pointerEvents:'none'}}>Modes : {entitlement.knowMe.modes.join(' + ')}</span>
        </div>}
        <button className="btn btn-primary" disabled={busy} onClick={()=>void chat()}>✦ Ouvrir le chat privé Nexus</button>
      </section>

      {!linked?(
        <form className="card" style={{padding:20,marginTop:16,display:'grid',gap:10}} onSubmit={link}>
          <h2 style={{margin:0}}>Connecter un compte Nexus</h2>
          <p style={{color:'var(--muted)',margin:0}}>Dans Nexus, génère un code de liaison KnowMe à usage unique, puis saisis-le ici. Le code expire rapidement et ne contient aucun token de session.</p>
          <input className="input" value={code} onChange={event=>setCode(event.target.value)} placeholder="Code Nexus à usage unique" autoComplete="off" minLength={16} maxLength={64}/>
          <button className="btn btn-primary" disabled={busy||code.trim().length<16}>{busy?'Connexion…':'Connecter Nexus'}</button>
        </form>
      ):(
        <section className="card" style={{padding:20,marginTop:16}}>
          <button className="btn" disabled={busy} onClick={()=>void unlink()}>Déconnecter le compte Nexus</button>
        </section>
      )}

      <section className="card" style={{padding:20,marginTop:16}}>
        <strong>Sécurité identique pour tous les plans</strong>
        <p style={{color:'var(--muted)',marginBottom:0}}>Plus, Pro ou Business augmentent les capacités et quotas, mais ne désactivent jamais les permissions, confirmations sensibles, protections des secrets, règles de confidentialité ou contrôles d’appareil.</p>
      </section>
      {message&&<p role="status" style={{color:'var(--orange)'}}>{message}</p>}
    </main>
  );
}

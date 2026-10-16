'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { KnowMeBrand } from '../components/knowme-brand';

export default function Home(){
  useEffect(()=>{
    if(window.localStorage.getItem('knowme_token'))window.location.replace('/messages');
  },[]);
  return (
    <main className="km-auth km-native-entry">
      <section className="km-auth-intro">
        <KnowMeBrand />
        <div className="km-auth-visual">
          <h2>Créez. Partagez.<br/><span>Découvrez.</span></h2>
        </div>
      </section>
      <section className="km-auth-panel">
        <KnowMeBrand className="km-native-auth-brand" />
        <h1 style={{marginBottom:24}}>Bienvenue sur KnowMe</h1>
        <Link className="km-auth-submit" href="/login">Se connecter</Link>
        <Link className="btn" href="/register" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:47,marginTop:12}}>Créer un compte</Link>
        <Link href="/update" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:46,marginTop:12,color:'var(--mint)',fontWeight:750,textAlign:'center',textDecoration:'underline',textUnderlineOffset:4}}>Mettre à jour l’application Android</Link>
      </section>
    </main>
  );
}

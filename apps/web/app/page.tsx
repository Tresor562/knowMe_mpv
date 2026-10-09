'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { KnowMeBrand } from '../components/knowme-brand';

export default function Home(){
  useEffect(()=>{
    if(window.localStorage.getItem('knowme_token'))window.location.replace('/messages');
  },[]);
  return (
    <main className="km-auth">
      <section className="km-auth-intro">
        <KnowMeBrand />
        <div className="km-auth-visual">
          <h2>Une autre façon<br/><span>de rester proches.</span></h2>
          <p>Des messages, des communautés et des expériences partagées. Retrouvez vos proches dans KnowMe, partout où vous êtes.</p>
        </div>
        <span className="km-auth-pill">KnowMe · par NexTech</span>
      </section>
      <section className="km-auth-panel">
        <h1>Bienvenue sur KnowMe</h1>
        <p className="km-auth-subtitle">Accédez à votre compte ou rejoignez la communauté.</p>
        <Link className="km-auth-submit" href="/login">Se connecter</Link>
        <Link className="btn" href="/register" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:47,marginTop:12}}>Créer un compte</Link>
        <p className="km-auth-help" style={{textAlign:'center',marginTop:20}}>Un espace personnel pour vos conversations.</p>
      </section>
    </main>
  );
}

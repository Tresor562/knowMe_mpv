'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Challenge = { id: string; status: string };
type UnreadCount = { count: number };

export default function Dashboard() {
  const { user, loading, logout } = useSession({ required: true });
  const [challengeCount, setChallengeCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      apiFetch<Challenge[]>('/challenges'),
      apiFetch<UnreadCount>('/notifications/unread-count')
    ]).then(([challenges, unread]) => {
      setChallengeCount(challenges.filter((challenge) => challenge.status === 'ACTIVE').length);
      setUnreadCount(unread.count);
    }).catch(() => {
      // Le tableau de bord reste utilisable si un widget secondaire échoue.
    });
  }, [user]);

  if (loading || !user) {
    return <main className="shell"><p>Chargement de ton univers...</p></main>;
  }

  const cards = [
    ['🔥 Défis actifs', `${challengeCount} défi(s) à poursuivre ou à relever.`, '/challenges'],
    ['🔔 Notifications', `${unreadCount} notification(s) non lue(s).`, '/notifications'],
    ['👥 Connexions', 'Recherche des amis et agrandis ton cercle.', '/friends'],
    ['🪙 KnowCoins', `${user.knowCoins ?? 0} KnowCoins disponibles.`, '/profile']
  ];

  return (
    <main className="shell" style={{maxWidth:1100,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'center',marginBottom:24,flexWrap:'wrap'}}>
        <div>
          <small style={{color:'var(--mint)'}}>BON RETOUR, @{user.username}</small>
          <h1 style={{margin:'4px 0'}}>Salut {user.displayName} 👋</h1>
          <p style={{color:'var(--muted)',margin:0}}>Voici ce qui se passe dans ton univers KnowMe.</p>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <Link href="/challenges" className="btn btn-accent">+ Nouveau défi</Link>
          <button className="btn" onClick={logout}>Déconnexion</button>
        </div>
      </header>

      <section className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))'}}>
        {cards.map(([title,text,href]) => (
          <Link href={href} key={title} className="card" style={{padding:22,display:'block'}}>
            <h2>{title}</h2>
            <p style={{color:'var(--muted)'}}>{text}</p>
          </Link>
        ))}
      </section>

      <section className="card" style={{padding:24,marginTop:22}}>
        <small style={{color:'var(--orange)'}}>PROCHAINE ACTION</small>
        <h2>Découvre quelque chose de nouveau sur un proche</h2>
        <p style={{color:'var(--muted)'}}>Lance un défi, partage une publication ou ouvre une conversation.</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <Link href="/challenges" className="btn btn-primary">Voir les défis</Link>
          <Link href="/feed" className="btn">Ouvrir le fil</Link>
          <Link href="/messages" className="btn">Mes messages</Link>
        </div>
      </section>
    </main>
  );
}

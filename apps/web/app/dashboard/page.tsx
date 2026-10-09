'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { KnowMeBrand } from '../../components/knowme-brand';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Challenge={id:string;status:string};
type NotificationUnreadCount={count:number};
type MessageUnreadCount={unread:number};
type HubIconName='chats'|'discover'|'search'|'challenges'|'friends'|'bookmarks'|'notifications'|'settings';

function HubIcon({name}:{name:HubIconName}){
  const p={viewBox:'0 0 24 24',width:22,height:22,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const};
  if(name==='chats') return <svg {...p}><path d="M20 11.5a8 8 0 0 1-8 8 8.4 8.4 0 0 1-3.2-.65L4 20l1.45-4A8 8 0 1 1 20 11.5Z"/></svg>;
  if(name==='discover') return <svg {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 8h8M8 12h8M8 16h4.5"/></svg>;
  if(name==='search') return <svg {...p}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>;
  if(name==='challenges') return <svg {...p}><path d="m13.5 2.5-9 11h6.6l-1 8 9.4-11h-6.7z"/></svg>;
  if(name==='friends') return <svg {...p}><circle cx="9" cy="8" r="3"/><path d="M2.5 20c.6-3.5 2.8-5 6.5-5s5.9 1.5 6.5 5M16 4.8c2.5 0 4 1.4 4 3.4s-1.5 3.4-4 3.4M17.4 15c2.7.4 4 2.1 4.1 5"/></svg>;
  if(name==='bookmarks') return <svg {...p}><path d="M6 3.5h12v17L12 17l-6 3.5z"/></svg>;
  if(name==='notifications') return <svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;
  return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M5 5.5 7 7M17 17l2 2M18.5 5.5 17 7M7 17l-2 2M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>;
}

export default function Dashboard(){
  const {user,loading,logout}=useSession({required:true});
  const [challengeCount,setChallengeCount]=useState(0);
  const [notificationCount,setNotificationCount]=useState(0);
  const [messageCount,setMessageCount]=useState(0);

  useEffect(()=>{
    if(!user)return;
    Promise.all([
      apiFetch<Challenge[]>('/challenges'),
      apiFetch<NotificationUnreadCount>('/notifications/unread-count'),
      apiFetch<MessageUnreadCount>('/conversations/unread-count')
    ]).then(([challenges,notifications,messages])=>{
      setChallengeCount(challenges.filter(c=>c.status==='ACTIVE').length);
      setNotificationCount(notifications.count);
      setMessageCount(messages.unread);
    }).catch(()=>{});
  },[user]);

  if(loading || !user) return <main className="shell"><span className="km-spinner" aria-label="Chargement"/></main>;

  const actions:{label:string;desc:string;href:string;icon:HubIconName;badge?:number}[]=[
    {label:'Discussions',desc:'Vos conversations personnelles',href:'/messages',icon:'chats',badge:messageCount},
    {label:'Fil d’actualité',desc:'Les dernières publications',href:'/feed',icon:'discover'},
    {label:'Rechercher',desc:'Personnes, groupes et contenus',href:'/search',icon:'search'},
    {label:'Défis',desc:'À découvrir ou à poursuivre',href:'/challenges',icon:'challenges',badge:challengeCount},
    {label:'Amis',desc:'Retrouver vos proches',href:'/friends',icon:'friends'},
    {label:'Messages enregistrés',desc:'Les éléments que vous conservez',href:'/saved-messages',icon:'bookmarks'},
    {label:'Notifications',desc:'Vos nouvelles activités',href:'/notifications',icon:'notifications',badge:notificationCount},
    {label:'Paramètres',desc:'Apparence, confidentialité et compte',href:'/settings',icon:'settings'}
  ];

  return <main className="shell km-hub">
    <header className="km-hub-header">
      <KnowMeBrand compact/>
      <div className="km-hub-account">
        <div className="km-hub-account-copy">
          <strong>{user.displayName}</strong>
          <span>@{user.username}</span>
        </div>
        <Link href="/profile" className="km-hub-avatar" aria-label="Ouvrir mon profil">{user.displayName.slice(0,1).toUpperCase()}</Link>
      </div>
    </header>
    <section className="km-hub-welcome">
      <p>Votre univers KnowMe</p>
      <h1>Bon retour, {user.displayName}.</h1>
      <div className="km-hub-summary">
        <Link href="/messages">{messageCount}<span>Messages non lus</span></Link>
        <Link href="/challenges">{challengeCount}<span>Défis actifs</span></Link>
        <Link href="/notifications">{notificationCount}<span>Notifications</span></Link>
      </div>
    </section>
    <section className="km-hub-menu" aria-label="Explorer KnowMe">
      <h2>Accès rapide</h2>
      <div className="km-hub-action-list">
        {actions.map(item=><Link className="km-hub-action" key={item.href} href={item.href}>
          <span className="km-hub-action-icon"><HubIcon name={item.icon}/></span>
          <span className="km-hub-action-text"><strong>{item.label}</strong><small>{item.desc}</small></span>
          {item.badge!==undefined&&item.badge>0&&<span className="km-chat-badge">{item.badge}</span>}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
        </Link>)}
      </div>
    </section>
    <button className="km-hub-logout" type="button" onClick={logout}>Se déconnecter</button>
  </main>;
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../components/i18n-provider';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Channel = {
  id: string;
  name: string;
  username?: string | null;
  description?: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  ownerId: string;
  _count: { subscriptions: number; posts: number };
  subscriptions?: Array<{userId:string}>;
};

export default function ChannelsPage() {
  const { user, loading: sessionLoading } = useSession({required:true});
  const {locale} = useI18n();
  const en=locale==='en';
  const tr=(fr:string,english:string)=>en?english:fr;
  const [tab,setTab]=useState<'mine'|'discover'>('mine');
  const [mine,setMine]=useState<Channel[]>([]);
  const [discovered,setDiscovered]=useState<Channel[]>([]);
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    if(!user)return;
    setLoading(true);
    try{
      const [owned,publicChannels]=await Promise.all([
        apiFetch<Channel[]>('/channels/mine'),
        apiFetch<Channel[]>('/channels/discover')
      ]);
      setMine(owned);
      setDiscovered(publicChannels);
      setError('');
    }catch(cause){
      setError(cause instanceof Error?cause.message:tr('Chaînes indisponibles.','Channels unavailable.'));
    }finally{setLoading(false);}
  },[user?.id,locale]);
  useEffect(()=>{void load();},[load]);

  const channels=useMemo(()=>{
    const rows=tab==='mine'?mine:discovered;
    const term=query.trim().toLocaleLowerCase();
    return rows.filter(channel=>[channel.name,channel.username||'',channel.description||'']
      .some(value=>value.toLocaleLowerCase().includes(term)));
  },[tab,mine,discovered,query]);

  if(sessionLoading||!user)return <main className="shell km-channels-page"><p>{tr('Chargement…','Loading…')}</p></main>;
  return <main className="shell km-channels-page">
    <header className="km-channels-header">
      <Link href="/messages" className="km-channel-icon-action" aria-label={tr('Retour aux discussions','Back to chats')}>
        <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>
      </Link>
      <h1>{tr('Chaînes','Channels')}</h1>
      <Link href="/channels/new" className="km-channel-icon-action" title={tr('Créer une chaîne','Create a channel')}
        aria-label={tr('Créer une chaîne','Create a channel')}>
        <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg>
      </Link>
    </header>
    <div className="km-channel-tabs" role="tablist" aria-label={tr('Mes chaînes et découvrir','My channels and discover')}>
      <button type="button" role="tab" aria-selected={tab==='mine'} onClick={()=>setTab('mine')}>{tr('Mes chaînes','My channels')}</button>
      <button type="button" role="tab" aria-selected={tab==='discover'} onClick={()=>setTab('discover')}>{tr('Découvrir','Discover')}</button>
    </div>
    <div className="km-channel-search">
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg>
      <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
        placeholder={tr('Rechercher des chaînes','Search channels')} aria-label={tr('Rechercher des chaînes','Search channels')}/>
    </div>
    {error&&<p className="km-auth-error" role="alert">{error}</p>}
    {loading&&<p className="km-channel-empty" role="status">{tr('Chargement des chaînes…','Loading channels…')}</p>}
    {!loading&&channels.length===0&&<div className="km-channel-empty">
      <p>{query?tr('Aucune chaîne correspondante.','No matching channels.'):
        tab==='mine'?tr('Aucune chaîne suivie pour le moment.','You are not following any channels yet.'):
        tr('Aucune chaîne publique disponible.','No public channels available.')}</p>
      {tab==='mine'&&<Link href="/channels/new">{tr('Créer ma première chaîne','Create my first channel')} →</Link>}
    </div>}
    <section className="km-channel-rows" aria-label={tr('Liste des chaînes','Channel list')}>
      {channels.map(channel=><Link key={channel.id} href={`/channels/${encodeURIComponent(channel.id)}`}
        className="km-channel-row">
        <span className="km-channel-avatar" aria-hidden="true">{Array.from(channel.name)[0]?.toLocaleUpperCase()||'C'}</span>
        <span className="km-channel-row-copy">
          <strong>{channel.name}</strong>
          <small>{channel.username?`@${channel.username}`:
            channel.visibility==='PRIVATE'?tr('Privée','Private'):tr('Publique','Public')} · {channel._count.subscriptions} {tr('abonnés','subscribers')}</small>
          {channel.description&&<span>{channel.description}</span>}
        </span>
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
      </Link>)}
    </section>
  </main>;
}

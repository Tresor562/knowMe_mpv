'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Sender = { id:string; displayName:string; username:string; avatarUrl?:string|null };
type Message = { id:string; content:string; createdAt:string; senderId:string; sender:Sender };
type ReadState = { userId:string; lastReadAt:string; user:Sender };
type History = { items:Message[]; nextCursor?:string|null; readStates:ReadState[] };
type MarkRead = { userId:string; lastReadAt:string; unread:number };

export default function ConversationPage() {
  const params = useParams<{id:string}>();
  const conversationId = params.id;
  const { user, loading:sessionLoading } = useSession({required:true});
  const [items,setItems] = useState<Message[]>([]);
  const [readStates,setReadStates] = useState<ReadState[]>([]);
  const [nextCursor,setNextCursor] = useState<string|null>(null);
  const [message,setMessage] = useState('');
  const [sending,setSending] = useState(false);
  const [loadingOlder,setLoadingOlder] = useState(false);
  const [refreshing,setRefreshing] = useState(false);

  const load = useCallback(async (cursor?:string) => {
    cursor ? setLoadingOlder(true) : setRefreshing(true);
    try {
      const query = new URLSearchParams({limit:'30'});
      if (cursor) query.set('cursor',cursor);
      const history = await apiFetch<History>(`/conversations/${conversationId}/messages?${query}`);
      setItems(current => {
        if (!cursor) return history.items;
        const known = new Set(current.map(item => item.id));
        return [...history.items.filter(item => !known.has(item.id)),...current];
      });
      setReadStates(history.readStates);
      setNextCursor(history.nextCursor ?? null);

      if (!cursor) {
        const marked = await apiFetch<MarkRead>(`/conversations/${conversationId}/read`,{method:'PATCH'});
        setReadStates(current => current.map(state => state.userId===marked.userId ? {...state,lastReadAt:marked.lastReadAt} : state));
      }
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setLoadingOlder(false);
      setRefreshing(false);
    }
  },[conversationId]);

  useEffect(() => { if (!sessionLoading) void load(); },[load,sessionLoading]);

  async function send(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const content = String(form.get('content') ?? '').trim();
    if (!content) return;
    setSending(true);
    try {
      const created = await apiFetch<Message>(`/conversations/${conversationId}/messages`,{
        method:'POST',
        body:JSON.stringify({content})
      });
      setItems(current => [...current,created]);
      setReadStates(current => current.map(state => state.userId===user?.id ? {...state,lastReadAt:created.createdAt} : state));
      formElement.reset();
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  }

  if (sessionLoading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{maxWidth:820,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div><small style={{color:'var(--mint)'}}>DISCUSSION</small><h1>Conversation</h1></div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn" disabled={refreshing} onClick={() => void load()}>{refreshing?'Actualisation…':'Actualiser'}</button>
          <Link href="/messages" className="btn">Retour</Link>
        </div>
      </header>

      {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}
      {nextCursor && <button className="btn" disabled={loadingOlder} onClick={() => void load(nextCursor)}>{loadingOlder?'Chargement…':'Charger les messages précédents'}</button>}

      <section className="card" style={{padding:18,minHeight:420,display:'flex',flexDirection:'column',gap:12,marginTop:14}}>
        {items.map(item => {
          const mine = item.senderId === user?.id;
          const readers = mine
            ? readStates.filter(state => state.userId!==user?.id && new Date(state.lastReadAt).getTime() >= new Date(item.createdAt).getTime())
            : [];
          return (
            <article key={item.id} style={{alignSelf:mine?'flex-end':'flex-start',maxWidth:'78%',background:mine?'var(--mint)':'var(--surface-2)',color:mine?'#06110e':'inherit',padding:'12px 14px',borderRadius:18}}>
              {!mine && <strong style={{display:'block',marginBottom:4}}>{item.sender.displayName}</strong>}
              <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{item.content}</div>
              <small style={{display:'block',marginTop:6,opacity:.7}}>{new Date(item.createdAt).toLocaleString('fr-FR')}</small>
              {mine && readers.length>0 && <small style={{display:'block',marginTop:3,opacity:.75}}>Lu par {readers.map(reader=>reader.user.displayName).join(', ')}</small>}
            </article>
          );
        })}
        {!items.length && <p style={{color:'var(--muted)'}}>Commence la conversation.</p>}
      </section>

      <form onSubmit={send} className="card" style={{padding:14,display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}>
        <input className="input" name="content" maxLength={2000} placeholder="Écris un message…" required style={{flex:'1 1 260px'}} autoComplete="off" />
        <button className="btn btn-primary" disabled={sending}>{sending?'Envoi…':'Envoyer'}</button>
      </form>
    </main>
  );
}

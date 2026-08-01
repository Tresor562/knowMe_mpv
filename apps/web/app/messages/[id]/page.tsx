'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Sender = { id:string; displayName:string; username:string; avatarUrl?:string|null };
type Message = { id:string; content:string; createdAt:string; senderId:string; sender:Sender };
type History = { items:Message[]; nextCursor?:string|null };

export default function ConversationPage() {
  const params = useParams<{id:string}>();
  const conversationId = params.id;
  const { user, loading:sessionLoading } = useSession({required:true});
  const [items,setItems] = useState<Message[]>([]);
  const [nextCursor,setNextCursor] = useState<string|null>(null);
  const [message,setMessage] = useState('');
  const [sending,setSending] = useState(false);

  const load = useCallback(async (cursor?:string) => {
    try {
      const query = new URLSearchParams({limit:'30'});
      if (cursor) query.set('cursor',cursor);
      const history = await apiFetch<History>(`/conversations/${conversationId}/messages?${query}`);
      setItems(current => cursor ? [...history.items,...current] : history.items);
      setNextCursor(history.nextCursor ?? null);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.');
    }
  },[conversationId]);

  useEffect(() => { if (!sessionLoading) load(); },[load,sessionLoading]);

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
      formElement.reset();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  }

  if (sessionLoading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{maxWidth:820,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><small style={{color:'var(--mint)'}}>DISCUSSION</small><h1>Conversation</h1></div>
        <Link href="/messages" className="btn">Retour</Link>
      </header>

      {message && <p style={{color:'var(--muted)'}}>{message}</p>}
      {nextCursor && <button className="btn" onClick={() => load(nextCursor)}>Charger les messages précédents</button>}

      <section className="card" style={{padding:18,minHeight:420,display:'flex',flexDirection:'column',gap:12,marginTop:14}}>
        {items.map(item => {
          const mine = item.senderId === user?.id;
          return (
            <article key={item.id} style={{alignSelf:mine?'flex-end':'flex-start',maxWidth:'78%',background:mine?'var(--mint)':'var(--surface-2)',color:mine?'#06110e':'inherit',padding:'12px 14px',borderRadius:18}}>
              {!mine && <strong style={{display:'block',marginBottom:4}}>{item.sender.displayName}</strong>}
              <div>{item.content}</div>
              <small style={{display:'block',marginTop:6,opacity:.7}}>{new Date(item.createdAt).toLocaleString('fr-FR')}</small>
            </article>
          );
        })}
        {!items.length && <p style={{color:'var(--muted)'}}>Commence la conversation.</p>}
      </section>

      <form onSubmit={send} className="card" style={{padding:14,display:'flex',gap:10,marginTop:14}}>
        <input className="input" name="content" placeholder="Écris un message…" required style={{flex:1}} autoComplete="off" />
        <button className="btn btn-primary" disabled={sending}>{sending?'Envoi…':'Envoyer'}</button>
      </form>
    </main>
  );
}

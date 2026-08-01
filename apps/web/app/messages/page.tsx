'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Member = { user: { id:string; displayName:string; username:string; avatarUrl?:string|null } };
type Message = { id:string; content:string; createdAt:string; senderId:string };
type Conversation = { id:string; title?:string|null; isGroup:boolean; members:Member[]; messages:Message[] };
type Friend = { user:{ id:string; displayName:string; username:string } };

export default function MessagesPage() {
  const { user, loading: sessionLoading } = useSession({ required:true });
  const [conversations,setConversations] = useState<Conversation[]>([]);
  const [friends,setFriends] = useState<Friend[]>([]);
  const [message,setMessage] = useState('');
  const [creating,setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [conversationData, friendData] = await Promise.all([
        apiFetch<Conversation[]>('/conversations'),
        apiFetch<Friend[]>('/social/friends')
      ]);
      setConversations(conversationData);
      setFriends(friendData);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.');
    }
  },[]);

  useEffect(() => { if (!sessionLoading) load(); },[load,sessionLoading]);

  async function createConversation(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const memberId = String(form.get('memberId') ?? '');
    const title = String(form.get('title') ?? '').trim();
    if (!memberId) return;
    setCreating(true);
    try {
      const conversation = await apiFetch<Conversation>('/conversations',{
        method:'POST',
        body:JSON.stringify({ memberIds:[memberId], title:title || undefined })
      });
      window.location.href = `/messages/${conversation.id}`;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Création impossible.');
    } finally {
      setCreating(false);
    }
  }

  if (sessionLoading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{maxWidth:900,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--mint)'}}>CONVERSATIONS</small>
        <h1>Messages</h1>
      </header>

      <form className="card" onSubmit={createConversation} style={{padding:18,display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,marginBottom:20}}>
        <select className="input" name="memberId" required defaultValue="">
          <option value="" disabled>Choisir un ami</option>
          {friends.map(({user:friend}) => <option key={friend.id} value={friend.id}>{friend.displayName} (@{friend.username})</option>)}
        </select>
        <input className="input" name="title" placeholder="Titre facultatif" />
        <button className="btn btn-primary" disabled={creating}>{creating ? 'Création…' : 'Nouvelle discussion'}</button>
      </form>

      {message && <p style={{color:'var(--muted)'}}>{message}</p>}

      <section className="card" style={{overflow:'hidden'}}>
        {conversations.map((conversation) => {
          const otherMembers = conversation.members.filter(member => member.user.id !== user?.id);
          const name = conversation.title || otherMembers.map(member => member.user.displayName).join(', ') || 'Conversation';
          const last = conversation.messages[0];
          return (
            <Link href={`/messages/${conversation.id}`} key={conversation.id} style={{display:'grid',gridTemplateColumns:'52px 1fr auto',gap:14,padding:18,borderBottom:'1px solid rgba(255,255,255,.06)',alignItems:'center'}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'var(--surface-2)',display:'grid',placeItems:'center',fontWeight:800}}>{name[0]}</div>
              <div><strong>{name}</strong><div style={{color:'var(--muted)',marginTop:4}}>{last?.content ?? 'Aucun message pour le moment.'}</div></div>
              <small style={{color:'var(--muted)'}}>{last ? new Date(last.createdAt).toLocaleString('fr-FR') : ''}</small>
            </Link>
          );
        })}
        {!conversations.length && <p style={{padding:20,color:'var(--muted)'}}>Aucune conversation.</p>}
      </section>
    </main>
  );
}

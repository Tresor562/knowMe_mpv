'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Member = {
  userId:string;
  lastReadAt:string;
  user:{ id:string; displayName:string; username:string; avatarUrl?:string|null };
};
type Message = {
  id:string;
  content:string;
  createdAt:string;
  senderId:string;
  sender?:{ id:string; displayName:string; username:string };
};
type Conversation = {
  id:string;
  title?:string|null;
  isGroup:boolean;
  members:Member[];
  messages:Message[];
  unreadCount:number;
  lastReadAt?:string|null;
};
type Friend = { user:{ id:string; displayName:string; username:string } };

export default function MessagesPage() {
  const { user, loading: sessionLoading } = useSession({ required:true });
  const [conversations,setConversations] = useState<Conversation[]>([]);
  const [friends,setFriends] = useState<Friend[]>([]);
  const [message,setMessage] = useState('');
  const [creating,setCreating] = useState(false);
  const [refreshing,setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [conversationData, friendData] = await Promise.all([
        apiFetch<Conversation[]>('/conversations'),
        apiFetch<Friend[]>('/social/friends')
      ]);
      setConversations(conversationData);
      setFriends(friendData);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setRefreshing(false);
    }
  },[]);

  useEffect(() => { if (!sessionLoading) void load(); },[load,sessionLoading]);

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

  const totalUnread = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

  return (
    <main className="shell" style={{maxWidth:900,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div>
          <small style={{color:'var(--mint)'}}>CONVERSATIONS</small>
          <h1>Messages</h1>
          <p style={{color:'var(--muted)'}}>{totalUnread} message(s) non lu(s)</p>
        </div>
        <button className="btn" disabled={refreshing} onClick={() => void load()}>{refreshing ? 'Actualisation…' : 'Actualiser'}</button>
      </header>

      <form className="card" onSubmit={createConversation} style={{padding:18,display:'grid',gridTemplateColumns:'minmax(180px,1fr) minmax(180px,1fr) auto',gap:10,marginBottom:20}}>
        <select className="input" name="memberId" required defaultValue="">
          <option value="" disabled>Choisir un ami</option>
          {friends.map(({user:friend}) => <option key={friend.id} value={friend.id}>{friend.displayName} (@{friend.username})</option>)}
        </select>
        <input className="input" name="title" placeholder="Titre facultatif" />
        <button className="btn btn-primary" disabled={creating}>{creating ? 'Création…' : 'Nouvelle discussion'}</button>
      </form>

      {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}

      <section className="card" style={{overflow:'hidden'}}>
        {conversations.map((conversation) => {
          const otherMembers = conversation.members.filter(member => member.user.id !== user?.id);
          const name = conversation.title || otherMembers.map(member => member.user.displayName).join(', ') || 'Conversation';
          const last = conversation.messages[0];
          const unread = conversation.unreadCount > 0;
          return (
            <Link
              href={`/messages/${conversation.id}`}
              key={conversation.id}
              style={{display:'grid',gridTemplateColumns:'52px minmax(0,1fr) auto',gap:14,padding:18,borderBottom:'1px solid rgba(255,255,255,.06)',alignItems:'center',background:unread?'rgba(69,230,189,.055)':'transparent'}}
            >
              <div style={{width:52,height:52,borderRadius:'50%',background:unread?'var(--mint)':'var(--surface-2)',color:unread?'#06110e':'inherit',display:'grid',placeItems:'center',fontWeight:900}}>{name[0]?.toUpperCase()}</div>
              <div style={{minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <strong>{name}</strong>
                  {unread && <span style={{background:'var(--orange)',color:'#1b0b04',borderRadius:999,minWidth:24,height:24,padding:'0 7px',display:'inline-grid',placeItems:'center',fontSize:12,fontWeight:900}}>{conversation.unreadCount}</span>}
                </div>
                <div style={{color:unread?'var(--text)':'var(--muted)',fontWeight:unread?700:400,marginTop:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {last ? `${last.senderId===user?.id?'Toi : ':''}${last.content}` : 'Aucun message pour le moment.'}
                </div>
              </div>
              <small style={{color:'var(--muted)',textAlign:'right'}}>{last ? new Date(last.createdAt).toLocaleString('fr-FR') : ''}</small>
            </Link>
          );
        })}
        {!conversations.length && <p style={{padding:20,color:'var(--muted)'}}>Aucune conversation.</p>}
      </section>
    </main>
  );
}

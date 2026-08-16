'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { getRealtimeSocket } from '../../lib/realtime';
import { useSession } from '../../lib/use-session';

type Member = {
  userId:string;
  lastReadAt:string;
  user:{ id:string; displayName:string; username:string; avatarUrl?:string|null };
};
type StickerPresentation = {
  kind:'STICKER';
  sticker:{label:string;glyph:string;accessibilityLabel:string};
};
type Message = {
  id:string;
  conversationId:string;
  content:string;
  createdAt:string;
  senderId:string;
  sender?:{ id:string; displayName:string; username:string };
  nexusAuthored?:boolean;
  presentation?:StickerPresentation|{kind:'TEXT';text:string};
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
type ConversationPinsResponse = {
  items:Array<{ conversationId:string }>;
  limit:number;
};
type Friend = { user:{ id:string; displayName:string; username:string } };
type ReadEvent = { conversationId:string; userId:string; lastReadAt:string };
type PresenceEvent = { userId:string; online:boolean };
type PresenceSnapshot = { onlineUserIds:string[] };

function preview(message:Message){
  return message.presentation?.kind==='STICKER'
    ? `${message.presentation.sticker.glyph} ${message.presentation.sticker.label}`
    : message.presentation?.kind==='TEXT'
      ? message.presentation.text
      : message.content;
}

export default function MessagesPage() {
  const { user, loading: sessionLoading } = useSession({ required:true });
  const socket = useMemo(()=>getRealtimeSocket(),[]);
  const [conversations,setConversations] = useState<Conversation[]>([]);
  const [friends,setFriends] = useState<Friend[]>([]);
  const [pinnedConversationIds,setPinnedConversationIds] = useState<Set<string>>(new Set());
  const [pinLimit,setPinLimit] = useState<number|null>(null);
  const [pinBusyId,setPinBusyId] = useState<string|null>(null);
  const [onlineUserIds,setOnlineUserIds] = useState<Set<string>>(new Set());
  const [message,setMessage] = useState('');
  const [live,setLive] = useState(false);
  const [creating,setCreating] = useState(false);
  const [creatingNexus,setCreatingNexus] = useState(false);
  const [refreshing,setRefreshing] = useState(false);

  const applyPinData = useCallback((pinData:ConversationPinsResponse) => {
    setPinnedConversationIds(new Set(pinData.items.map((pin) => pin.conversationId)));
    setPinLimit(pinData.limit);
  },[]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [conversationData, friendData, pinData] = await Promise.all([
        apiFetch<Conversation[]>('/conversations'),
        apiFetch<Friend[]>('/social/friends'),
        apiFetch<ConversationPinsResponse>('/conversation-pins')
      ]);
      setConversations(conversationData);
      setFriends(friendData);
      applyPinData(pinData);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setRefreshing(false);
    }
  },[applyPinData]);

  useEffect(()=>{if(!sessionLoading)void load();},[load,sessionLoading]);

  useEffect(()=>{
    if(sessionLoading||!user)return;

    const connected=()=>setLive(true);
    const disconnected=()=>setLive(false);
    const incoming=(created:Message)=>{
      setConversations(current=>{
        const index=current.findIndex(conversation=>conversation.id===created.conversationId);
        if(index<0){void load();return current;}
        const conversation=current[index];
        const alreadyKnown=conversation.messages[0]?.id===created.id;
        const updated:Conversation={
          ...conversation,
          messages:[created],
          unreadCount:created.senderId===user.id||alreadyKnown?conversation.unreadCount:conversation.unreadCount+1
        };
        return [updated,...current.filter(item=>item.id!==updated.id)];
      });
    };
    const read=(event:ReadEvent)=>{
      if(event.userId!==user.id)return;
      setConversations(current=>current.map(conversation=>conversation.id===event.conversationId?{...conversation,unreadCount:0,lastReadAt:event.lastReadAt}:conversation));
    };
    const presence=(event:PresenceEvent)=>{
      setOnlineUserIds(current=>{
        const next=new Set(current);
        event.online?next.add(event.userId):next.delete(event.userId);
        return next;
      });
    };
    const snapshot=(event:PresenceSnapshot)=>setOnlineUserIds(new Set(event.onlineUserIds));

    socket.on('connect',connected);
    socket.on('disconnect',disconnected);
    socket.on('message:created',incoming);
    socket.on('conversation:read',read);
    socket.on('presence:update',presence);
    socket.on('presence:snapshot',snapshot);
    if(socket.connected)connected();else socket.connect();

    return()=>{
      socket.off('connect',connected);
      socket.off('disconnect',disconnected);
      socket.off('message:created',incoming);
      socket.off('conversation:read',read);
      socket.off('presence:update',presence);
      socket.off('presence:snapshot',snapshot);
    };
  },[load,sessionLoading,socket,user]);

  useEffect(()=>{
    if(!socket.connected||!user)return;
    const peerIds=[...new Set(conversations.flatMap(conversation=>conversation.members.map(member=>member.user.id)).filter(id=>id!==user.id))];
    if(peerIds.length)socket.emit('presence:query',{userIds:peerIds});
  },[conversations,socket,user]);

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

  async function openNexusConversation() {
    if (creatingNexus) return;
    setCreatingNexus(true);
    try {
      const conversation = await apiFetch<Conversation>('/nexus-social/private-conversation', {
        method:'POST',
        body:'{}'
      });
      window.location.href = `/messages/${conversation.id}`;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Nexus est indisponible.');
      setCreatingNexus(false);
    }
  }

  async function togglePin(conversationId:string) {
    if(pinBusyId)return;
    const pinned=pinnedConversationIds.has(conversationId);
    if(!pinned && (pinLimit===null || pinnedConversationIds.size>=pinLimit)) {
      setMessage(pinLimit===null ? 'Capacité d’épinglage indisponible.' : `La limite de ${pinLimit} conversations épinglées est atteinte.`);
      return;
    }
    setPinBusyId(conversationId);
    try {
      await apiFetch(`/conversation-pins/${conversationId}`,{method:pinned?'DELETE':'PUT'});
      const authoritative = await apiFetch<ConversationPinsResponse>('/conversation-pins');
      applyPinData(authoritative);
      setMessage('');
    } catch(cause) {
      setMessage(cause instanceof Error ? cause.message : 'Mise à jour de l’épingle impossible.');
    } finally {
      setPinBusyId(null);
    }
  }

  if (sessionLoading) return <main className="shell">Chargement…</main>;

  const totalUnread = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const orderedConversations = [...conversations].sort((left,right) => {
    const leftPinned = pinnedConversationIds.has(left.id);
    const rightPinned = pinnedConversationIds.has(right.id);
    return leftPinned === rightPinned ? 0 : leftPinned ? -1 : 1;
  });

  return (
    <main className="shell" style={{maxWidth:900,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div>
          <small style={{color:'var(--mint)'}}>CONVERSATIONS · {live?'EN DIRECT':'HORS LIGNE'}</small>
          <h1>Messages</h1>
          <p style={{color:'var(--muted)'}}>{totalUnread} message(s) non lu(s)</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Link href="/conversation-pins" className="btn">📌 Épinglées</Link>
          <Link href="/saved-messages" className="btn">🔖 Enregistrés</Link>
          <button className="btn btn-primary" disabled={creatingNexus} onClick={() => void openNexusConversation()}>
            {creatingNexus?'Ouverture…':'✦ Parler à Nexus'}
          </button>
          <button className="btn" disabled={refreshing} onClick={() => void load()}>{refreshing ? 'Actualisation…' : 'Actualiser'}</button>
        </div>
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
        {orderedConversations.map((conversation) => {
          const otherMembers = conversation.members.filter(member => member.user.id !== user?.id);
          const name = conversation.title || otherMembers.map(member => member.user.displayName).join(', ') || 'Conversation';
          const last = conversation.messages[0];
          const unread = conversation.unreadCount > 0;
          const pinned = pinnedConversationIds.has(conversation.id);
          const isNexus = name === 'Nexus' && otherMembers.length === 0;
          const online=!isNexus&&otherMembers.some(member=>onlineUserIds.has(member.user.id));
          const pinDisabled=pinBusyId!==null || (!pinned && (pinLimit===null || pinnedConversationIds.size>=pinLimit));
          return (
            <div
              key={conversation.id}
              style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:12,padding:18,borderBottom:'1px solid rgba(255,255,255,.06)',alignItems:'center',background:unread?'rgba(69,230,189,.055)':'transparent'}}
            >
              <Link href={`/messages/${conversation.id}`} style={{display:'grid',gridTemplateColumns:'52px minmax(0,1fr) auto',gap:14,alignItems:'center',minWidth:0,color:'inherit',textDecoration:'none'}}>
                <div style={{position:'relative',width:52,height:52,borderRadius:'50%',background:isNexus?'linear-gradient(135deg,#45e6bd,#776cff)':unread?'var(--mint)':'var(--surface-2)',color:isNexus||unread?'#06110e':'inherit',display:'grid',placeItems:'center',fontWeight:900}}>
                  {isNexus?'✦':name[0]?.toUpperCase()}
                  {!isNexus&&<span aria-label={online?'En ligne':'Hors ligne'} style={{position:'absolute',right:0,bottom:1,width:13,height:13,borderRadius:'50%',background:online?'#45e6bd':'#607a70',border:'2px solid var(--surface)'}} />}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <strong>{name}</strong>
                    {pinned&&<small aria-label="Conversation épinglée" title="Conversation épinglée" style={{color:'var(--mint)'}}>📌 épinglée</small>}
                    {isNexus&&<small style={{color:'var(--mint)'}}>assistant privé</small>}
                    {online&&<small style={{color:'var(--mint)'}}>en ligne</small>}
                    {unread && <span style={{background:'var(--orange)',color:'#1b0b04',borderRadius:999,minWidth:24,height:24,padding:'0 7px',display:'inline-grid',placeItems:'center',fontSize:12,fontWeight:900}}>{conversation.unreadCount}</span>}
                  </div>
                  <div style={{color:unread?'var(--text)':'var(--muted)',fontWeight:unread?700:400,marginTop:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {last ? `${last.senderId===user?.id?'Toi : ':last.nexusAuthored?'Nexus : ':''}${preview(last)}` : isNexus?'Pose une question à Nexus.':'Aucun message pour le moment.'}
                  </div>
                </div>
                <small style={{color:'var(--muted)',textAlign:'right'}}>{last ? new Date(last.createdAt).toLocaleString('fr-FR') : ''}</small>
              </Link>
              <button
                type="button"
                className="btn"
                aria-pressed={pinned}
                aria-label={pinned?`Désépingler ${name}`:`Épingler ${name}`}
                title={pinned?'Désépingler':'Épingler'}
                disabled={pinDisabled}
                onClick={() => void togglePin(conversation.id)}
                style={{minWidth:46}}
              >
                {pinBusyId===conversation.id?'…':pinned?'📌':'＋📌'}
              </button>
            </div>
          );
        })}
        {!conversations.length && <p style={{padding:20,color:'var(--muted)'}}>Aucune conversation.</p>}
      </section>
    </main>
  );
}

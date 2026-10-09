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
    <main className="shell km-messages">
      <header className="km-messages-header">
        <div>
          <div className="km-msg-eyebrow">KnowMe <span aria-hidden="true">/</span> Messagerie</div>
          <h1>Discussions</h1>
          <p className="km-msg-status"><span className={live?'km-live-dot':'km-offline-dot'}/> {live?'Connecté':'Connexion en attente'}{totalUnread>0 ? ` · ${totalUnread} non lu${totalUnread>1?'s':''}` : ''}</p>
        </div>
        <div className="km-msg-actions">
          <Link href="/saved-messages" className="km-action" aria-label="Messages enregistrés" title="Messages enregistrés">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5h12v17L12 17l-6 3.5z"/></svg>
          </Link>
          <Link href="/conversation-pins" className="km-action" aria-label="Discussions épinglées" title="Discussions épinglées">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 3 6 6-3 1-4 4-1 4-7-7 4-1 4-4zM3 21l7-7"/></svg>
          </Link>
          <button type="button" className="km-action" onClick={()=>void load()} disabled={refreshing} aria-label={refreshing?'Actualisation en cours':'Actualiser'} title="Actualiser">
            <svg className={refreshing?'km-rotate':''} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 11.5a8.5 8.5 0 0 0-14.5-5.8L3.5 8.3M3.5 3.5v4.8h4.8M3.5 12.5a8.5 8.5 0 0 0 14.5 5.8l2.5-2.6M20.5 20.5v-4.8h-4.8"/></svg>
          </button>
        </div>
      </header>

      <details className="km-compose">
        <summary className="km-compose-toggle">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          Nouvelle discussion
        </summary>
        <form onSubmit={createConversation} className="km-compose-form">
          <label>Choisir un ami
            <select className="input" name="memberId" required defaultValue="">
              <option value="" disabled>Sélectionner une personne</option>
              {friends.map(({user:friend})=><option key={friend.id} value={friend.id}>{friend.displayName} (@{friend.username})</option>)}
            </select>
          </label>
          <label>Nom de la discussion (facultatif)
            <input className="input" name="title" placeholder="Discussion" />
          </label>
          <button className="btn btn-primary" disabled={creating}>{creating?'Création…':'Démarrer la discussion'}</button>
        </form>
      </details>

      {message && <p className="km-auth-error" role="alert">{message}</p>}

      <section aria-label="Liste des conversations" className="km-chat-list">
        {orderedConversations.map((conversation) => {
          const otherMembers = conversation.members.filter(member=>member.user.id!==user?.id);
          const name=conversation.title || otherMembers.map(member=>member.user.displayName).join(', ') || 'Conversation';
          const last=conversation.messages[0];
          const unread=conversation.unreadCount>0;
          const pinned=pinnedConversationIds.has(conversation.id);
          const isNexus=name==='Nexus'&&otherMembers.length===0;
          const online=!isNexus&&otherMembers.some(member=>onlineUserIds.has(member.user.id));
          const pinDisabled=pinBusyId!==null || (!pinned && (pinLimit===null || pinnedConversationIds.size>=pinLimit));
          return <article className={`km-chat-row${unread?' km-chat-unread':''}`} key={conversation.id}>
            <Link href={`/messages/${conversation.id}`} className="km-chat-main" aria-label={`Ouvrir la discussion ${name}`}>
              <div className={`km-chat-avatar${isNexus?' km-chat-ai':''}`}>
                {isNexus ? <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/></svg> : name.slice(0,1).toUpperCase()}
                {online && <span className="km-chat-online" aria-label="En ligne"/>}
              </div>
              <div className="km-chat-copy">
                <div className="km-chat-firstline">
                  <strong>{name}</strong>
                  {pinned && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="Épinglée"><path d="m14 4 6 6-3 1-4 4-1 4-7-7 4-1 4-4z"/></svg>}
                  {unread && <span className="km-chat-badge">{conversation.unreadCount}</span>}
                </div>
                <p className="km-chat-preview">{last?`${last.senderId===user?.id?'Vous : ':last.nexusAuthored?'Nexus : ':''}${preview(last)}`:isNexus?'Discuter avec Nexus':'Aucun message pour le moment'}</p>
              </div>
              <time className="km-chat-time" dateTime={last?.createdAt}>{last?new Date(last.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):''}</time>
            </Link>
            <div className="km-chat-quick-actions">
              <Link href={`/messages/${conversation.id}/organization`} className="km-mini-action" title="Organisation de la discussion" aria-label={`Organisation de ${name}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h16M8 4v7M16 4v7M5 20h14V11H5z"/></svg>
              </Link>
              <button type="button" className="km-mini-action" aria-pressed={pinned} aria-label={pinned?`Désépingler ${name}`:`Épingler ${name}`} title={pinned?'Désépingler':'Épingler'} disabled={pinDisabled} onClick={()=>void togglePin(conversation.id)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 4 6 6-3 1-4 4-1 4-7-7 4-1 4-4zM4 20l6-6"/></svg>
              </button>
            </div>
          </article>;
        })}
        {!orderedConversations.length && <div className="km-chat-empty">
          <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5a7.8 7.8 0 0 1-8.2 7.7 9 9 0 0 1-3.3-.7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/></svg>
          <h2>Aucune discussion pour le moment</h2>
          <p>Commencez une conversation ou retrouvez vos amis sur KnowMe.</p>
          <button type="button" className="btn btn-primary" disabled={creatingNexus} onClick={()=>void openNexusConversation()}>{creatingNexus?'Ouverture…':'Discuter avec Nexus'}</button>
        </div>}
      </section>
    </main>
  );
}

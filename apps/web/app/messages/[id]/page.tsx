'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { getRealtimeSocket } from '../../../lib/realtime';
import { useSession } from '../../../lib/use-session';
import { StickerPicker } from './StickerPicker';

type Sender = {
  id:string;
  displayName:string;
  username:string;
  avatarUrl?:string|null;
};
type StickerPresentation = {
  kind:'STICKER';
  pack:{key:string;version:number;name:string};
  sticker:{
    key:string;
    version:number;
    label:string;
    glyph:string;
    accessibilityLabel:string;
  };
  issuedAt:string;
  expiresAt:string;
  visualOnly:true;
  externalAssetAllowed:false;
  arbitraryHtmlAllowed:false;
};
type TextPresentation = {kind:'TEXT';text:string};
type Message = {
  id:string;
  conversationId:string;
  content:string;
  createdAt:string;
  senderId:string;
  sender:Sender;
  nexusAuthored?:boolean;
  presentation?:StickerPresentation|TextPresentation;
};
type ReadState = {
  userId:string;
  lastReadAt:string;
  user:Sender;
};
type History = {
  items:Message[];
  nextCursor?:string|null;
  readStates:ReadState[];
};
type MarkRead = { userId:string; lastReadAt:string; unread:number };
type ReadEvent = { conversationId:string; userId:string; lastReadAt:string };
type TypingEvent = {
  conversationId:string;
  userId:string;
  username?:string;
  typing:boolean;
};
type PresenceEvent = { userId:string; online:boolean };
type PresenceSnapshot = { onlineUserIds:string[] };

const NEXUS_MENTION=/(^|\s)@nexus\b/i;

function mergeMessages(current:Message[],incoming:Message[],prepend=false){
  const known=new Set(current.map(item=>item.id));
  const fresh=incoming.filter(item=>!known.has(item.id));
  return prepend?[...fresh,...current]:[...current,...fresh];
}

function MessageContent({item}:{item:Message}){
  if(item.presentation?.kind==='STICKER'){
    return(
      <div
        aria-label={item.presentation.sticker.accessibilityLabel}
        title={`${item.presentation.pack.name} · ${item.presentation.sticker.label}`}
        style={{display:'grid',placeItems:'center',gap:4,minWidth:90,minHeight:72}}
      >
        <span aria-hidden="true" style={{fontSize:44,lineHeight:1}}>
          {item.presentation.sticker.glyph}
        </span>
        <small style={{opacity:.75}}>{item.presentation.sticker.label}</small>
      </div>
    );
  }
  return(
    <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>
      {item.presentation?.kind==='TEXT'?item.presentation.text:item.content}
    </div>
  );
}

export default function ConversationPage() {
  const params=useParams<{id:string}>();
  const conversationId=params.id;
  const {user,loading:sessionLoading}=useSession({required:true});
  const socket=useMemo(()=>getRealtimeSocket(),[]);
  const userIdRef=useRef<string|null>(null);
  const typingTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const typingActive=useRef(false);

  const [items,setItems]=useState<Message[]>([]);
  const [readStates,setReadStates]=useState<ReadState[]>([]);
  const [onlineUserIds,setOnlineUserIds]=useState<Set<string>>(new Set());
  const [typingUsers,setTypingUsers]=useState<Record<string,string>>({});
  const [draft,setDraft]=useState('');
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  const [socketStatus,setSocketStatus]=useState<'connecting'|'connected'|'offline'>('connecting');
  const [sending,setSending]=useState(false);
  const [nexusPending,setNexusPending]=useState(false);
  const [loadingOlder,setLoadingOlder]=useState(false);
  const [refreshing,setRefreshing]=useState(false);

  useEffect(()=>{
    userIdRef.current=user?.id??null;
  },[user?.id]);

  const markRead=useCallback(async()=>{
    const marked=await apiFetch<MarkRead>(
      `/conversations/${conversationId}/read`,
      {method:'PATCH'}
    );
    setReadStates(current=>current.map(state=>
      state.userId===marked.userId
        ? {...state,lastReadAt:marked.lastReadAt}
        : state
    ));
  },[conversationId]);

  const load=useCallback(async(cursor?:string)=>{
    cursor?setLoadingOlder(true):setRefreshing(true);
    try{
      const query=new URLSearchParams({limit:'30'});
      if(cursor)query.set('cursor',cursor);
      const history=await apiFetch<History>(
        `/conversations/${conversationId}/messages?${query}`
      );
      setItems(current=>
        cursor?mergeMessages(current,history.items,true):history.items
      );
      setReadStates(history.readStates);
      setNextCursor(history.nextCursor??null);
      if(!cursor)await markRead();
      setMessage('');
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'Chargement impossible.');
    }finally{
      setLoadingOlder(false);
      setRefreshing(false);
    }
  },[conversationId,markRead]);

  useEffect(()=>{
    if(!sessionLoading)void load();
  },[load,sessionLoading]);

  useEffect(()=>{
    if(sessionLoading||!user)return;

    const join=()=>{
      setSocketStatus('connected');
      socket.emit('conversation:join',{conversationId});
    };
    const disconnect=()=>setSocketStatus('offline');
    const connectError=(error:Error)=>{
      setSocketStatus('offline');
      setMessage(`Temps réel indisponible : ${error.message}`);
    };
    const onMessage=(created:Message)=>{
      if(created.conversationId!==conversationId)return;
      setItems(current=>mergeMessages(current,[created]));
      if(created.senderId!==userIdRef.current){
        void markRead().catch(()=>undefined);
      }
    };
    const onRead=(event:ReadEvent)=>{
      if(event.conversationId!==conversationId)return;
      setReadStates(current=>current.map(state=>
        state.userId===event.userId
          ? {...state,lastReadAt:event.lastReadAt}
          : state
      ));
    };
    const onTyping=(event:TypingEvent)=>{
      if(
        event.conversationId!==conversationId||
        event.userId===userIdRef.current
      )return;
      setTypingUsers(current=>{
        const next={...current};
        if(event.typing)next[event.userId]=event.username??'Quelqu’un';
        else delete next[event.userId];
        return next;
      });
    };
    const onPresence=(event:PresenceEvent)=>{
      setOnlineUserIds(current=>{
        const next=new Set(current);
        event.online?next.add(event.userId):next.delete(event.userId);
        return next;
      });
    };
    const onSnapshot=(snapshot:PresenceSnapshot)=>{
      setOnlineUserIds(new Set(snapshot.onlineUserIds));
    };
    const onRoomError=(event:{conversationId:string;message:string})=>{
      if(event.conversationId===conversationId)setMessage(event.message);
    };

    socket.on('connect',join);
    socket.on('disconnect',disconnect);
    socket.on('connect_error',connectError);
    socket.on('message:created',onMessage);
    socket.on('conversation:read',onRead);
    socket.on('typing:update',onTyping);
    socket.on('presence:update',onPresence);
    socket.on('presence:snapshot',onSnapshot);
    socket.on('conversation:error',onRoomError);

    if(socket.connected)join();
    else socket.connect();

    return()=>{
      if(typingTimer.current)clearTimeout(typingTimer.current);
      if(typingActive.current)socket.emit('typing:stop',{conversationId});
      socket.emit('conversation:leave',{conversationId});
      socket.off('connect',join);
      socket.off('disconnect',disconnect);
      socket.off('connect_error',connectError);
      socket.off('message:created',onMessage);
      socket.off('conversation:read',onRead);
      socket.off('typing:update',onTyping);
      socket.off('presence:update',onPresence);
      socket.off('presence:snapshot',onSnapshot);
      socket.off('conversation:error',onRoomError);
    };
  },[conversationId,markRead,sessionLoading,socket,user]);

  const peerIds=useMemo(
    ()=>readStates.map(state=>state.userId).filter(id=>id!==user?.id),
    [readStates,user?.id]
  );
  const isNexusPrivate=Boolean(user?.id&&readStates.length===1&&readStates[0]?.userId===user.id);

  useEffect(()=>{
    if(socketStatus!=='connected'||!peerIds.length)return;
    socket.emit('presence:query',{userIds:peerIds});
  },[peerIds,socket,socketStatus]);

  function changeDraft(value:string){
    setDraft(value);
    if(!typingActive.current){
      typingActive.current=true;
      socket.emit('typing:start',{conversationId});
    }
    if(typingTimer.current)clearTimeout(typingTimer.current);
    typingTimer.current=setTimeout(()=>{
      typingActive.current=false;
      socket.emit('typing:stop',{conversationId});
    },900);
  }

  function stopTyping(){
    if(typingTimer.current)clearTimeout(typingTimer.current);
    if(typingActive.current)socket.emit('typing:stop',{conversationId});
    typingActive.current=false;
  }

  function acceptSent(created:Message){
    setItems(current=>mergeMessages(current,[created]));
    setReadStates(current=>current.map(state=>
      state.userId===user?.id
        ? {...state,lastReadAt:created.createdAt}
        : state
    ));
    setMessage('');
  }

  async function invokeNexus(created:Message){
    if(!user?.id)return;
    setNexusPending(true);
    try{
      const reply=await apiFetch<Message>(
        `/conversations/${conversationId}/nexus/reply`,
        {
          method:'POST',
          body:JSON.stringify({
            sourceMessageId:created.id,
            idempotencyKey:`web:${conversationId}:${created.id}:${user.id}`,
            mode:'instant'
          })
        }
      );
      setItems(current=>mergeMessages(current,[reply]));
      void markRead().catch(()=>undefined);
    }catch(cause){
      setMessage(`Message envoyé, mais Nexus n'a pas répondu : ${cause instanceof Error?cause.message:'service indisponible.'}`);
    }finally{
      setNexusPending(false);
    }
  }

  async function send(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const content=draft.trim();
    if(!content)return;
    setSending(true);
    stopTyping();
    try{
      const created=await apiFetch<Message>(
        `/conversations/${conversationId}/messages`,
        {method:'POST',body:JSON.stringify({content})}
      );
      acceptSent(created);
      setDraft('');
      if(isNexusPrivate||NEXUS_MENTION.test(content)){
        await invokeNexus(created);
      }
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'Envoi impossible.');
    }finally{
      setSending(false);
    }
  }

  if(sessionLoading){
    return <main className="shell">Chargement…</main>;
  }

  const typingNames=Object.values(typingUsers);
  const peers=readStates.filter(state=>state.userId!==user?.id);

  return(
    <main className="shell" style={{maxWidth:820,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div>
          <small style={{color:'var(--mint)'}}>
            {isNexusPrivate?'NEXUS · PRIVÉ':`DISCUSSION · ${socketStatus==='connected'
              ?'EN DIRECT'
              :socketStatus==='connecting'
                ?'CONNEXION…'
                :'HORS LIGNE'}`}
          </small>
          <h1>{isNexusPrivate?'Nexus':'Conversation'}</h1>
          {isNexusPrivate&&<p style={{color:'var(--muted)',margin:0}}>Conversation explicite avec Nexus. Aucun accès caché à tes autres discussions.</p>}
          {peers.length>0&&(
            <p style={{color:'var(--muted)',margin:0}}>
              {peers.map(peer=>
                `${onlineUserIds.has(peer.userId)?'●':'○'} ${peer.user.displayName}`
              ).join(' · ')}
            </p>
          )}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button
            className="btn"
            disabled={refreshing}
            onClick={()=>void load()}
          >
            {refreshing?'Actualisation…':'Actualiser'}
          </button>
          <Link href="/messages" className="btn">Retour</Link>
        </div>
      </header>

      {message&&(
        <p role="alert" style={{color:'var(--orange)'}}>{message}</p>
      )}
      {nextCursor&&(
        <button
          className="btn"
          disabled={loadingOlder}
          onClick={()=>void load(nextCursor)}
        >
          {loadingOlder?'Chargement…':'Charger les messages précédents'}
        </button>
      )}

      <section className="card" style={{padding:18,minHeight:420,display:'flex',flexDirection:'column',gap:12,marginTop:14}}>
        {items.map(item=>{
          const mine=item.senderId===user?.id;
          const nexus=item.nexusAuthored===true;
          const readers=mine
            ?readStates.filter(state=>
                state.userId!==user?.id&&
                new Date(state.lastReadAt).getTime()>=
                  new Date(item.createdAt).getTime()
              )
            :[];
          return(
            <article
              key={item.id}
              style={{
                alignSelf:mine?'flex-end':'flex-start',
                maxWidth:'78%',
                background:mine?'var(--mint)':nexus?'linear-gradient(135deg,rgba(69,230,189,.15),rgba(119,108,255,.15))':'var(--surface-2)',
                border:nexus?'1px solid rgba(119,108,255,.35)':'none',
                color:mine?'#06110e':'inherit',
                padding:'12px 14px',
                borderRadius:18
              }}
            >
              {!mine&&(
                <strong style={{display:'block',marginBottom:4,color:nexus?'var(--mint)':'inherit'}}>
                  {nexus?'✦ Nexus':item.sender.displayName}
                </strong>
              )}
              <MessageContent item={item}/>
              <small style={{display:'block',marginTop:6,opacity:.7}}>
                {new Date(item.createdAt).toLocaleString('fr-FR')}
              </small>
              {mine&&readers.length>0&&(
                <small style={{display:'block',marginTop:3,opacity:.75}}>
                  Lu par {readers.map(reader=>reader.user.displayName).join(', ')}
                </small>
              )}
            </article>
          );
        })}
        {!items.length&&(
          <p style={{color:'var(--muted)'}}>{isNexusPrivate?'Écris ton premier message à Nexus.':'Commence la conversation.'}</p>
        )}
        {nexusPending&&<p aria-live="polite" style={{color:'var(--mint)',fontStyle:'italic',margin:0}}>✦ Nexus réfléchit…</p>}
        {typingNames.length>0&&(
          <p aria-live="polite" style={{color:'var(--mint)',fontStyle:'italic',margin:0}}>
            {typingNames.join(', ')}{' '}
            {typingNames.length>1?'écrivent':'écrit'}…
          </p>
        )}
      </section>

      <form
        onSubmit={send}
        className="card"
        style={{padding:14,display:'flex',gap:10,marginTop:14,flexWrap:'wrap',alignItems:'center'}}
      >
        {!isNexusPrivate&&<StickerPicker<Message>
          conversationId={conversationId}
          onSent={acceptSent}
        />}
        <input
          className="input"
          value={draft}
          onChange={event=>changeDraft(event.target.value)}
          onBlur={stopTyping}
          maxLength={2000}
          placeholder={isNexusPrivate?'Écris à Nexus…':'Écris un message… Utilise @Nexus pour l’invoquer.'}
          required
          style={{flex:'1 1 260px'}}
          autoComplete="off"
        />
        <button className="btn btn-primary" disabled={sending||nexusPending}>
          {sending?'Envoi…':nexusPending?'Nexus…':'Envoyer'}
        </button>
      </form>
    </main>
  );
}

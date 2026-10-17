'use client';

import Link from 'next/link';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { getRealtimeSocket } from '../../../lib/realtime';
import { useSession, type StaffBadge } from '../../../lib/use-session';
import { AccountBadges } from '../../../components/AccountBadges';
import { StickerPicker } from './StickerPicker';
import { ChatMediaView } from './ChatMediaView';
import { AnimatedEmojiText, AnimatedEmojiGlyph } from '../../../components/AnimatedEmoji';
import { useI18n } from '../../../components/i18n-provider';
import referenceStyles from './reference-chat.module.css';

type Sender = {
  id:string;
  displayName:string;
  username:string;
  avatarUrl?:string|null;
  staff?:StaffBadge|null;
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
type MediaPresentation = {kind:'GIF'|'STICKER_IMAGE'|'IMAGE'|'VIDEO'|'AUDIO'|'DOCUMENT';assetId:string;mimeType:string;fileName?:string;sizeBytes?:number};
type Message = {
  id:string;
  conversationId:string;
  content:string;
  createdAt:string;
  senderId:string;
  sender:Sender;
  nexusAuthored?:boolean;
  presentation?:StickerPresentation|TextPresentation|MediaPresentation;
};
type ReadState = {
  userId:string;
  lastReadAt:string;
  user:Sender;
};
type ChatSummary = { id:string; title:string|null; isGroup:boolean; members:Array<{userId:string}> };

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
  if(item.presentation?.kind==='GIF'||item.presentation?.kind==='STICKER_IMAGE'||item.presentation?.kind==='IMAGE'||
    item.presentation?.kind==='VIDEO'||item.presentation?.kind==='AUDIO'||item.presentation?.kind==='DOCUMENT') {
    return <ChatMediaView assetId={item.presentation.assetId} kind={item.presentation.kind} fileName={item.presentation.fileName} avatarUrl={item.sender?.avatarUrl} enablePreview/>;
  }
  if(item.presentation?.kind==='STICKER'){
    return(
      <details className="km-chat-glyph-sticker">
        <summary aria-label={`Options du sticker : ${item.presentation.sticker.accessibilityLabel}`}
          title={`${item.presentation.pack.name} · ${item.presentation.sticker.label}`}>
          <span style={{fontSize:44,lineHeight:1}}><AnimatedEmojiGlyph glyph={item.presentation.sticker.glyph}/></span>
          <small>{item.presentation.sticker.label}</small>
        </summary>
        <div className="km-chat-glyph-sticker-actions">
          <strong>{item.presentation.pack.name}</strong>
          <Link href={`/stickers/${encodeURIComponent(item.presentation.pack.key)}`}>
            Voir le pack
          </Link>
          <Link href={buildKnowMePublicLink({kind:'message',id:item.id})}>
            Ouvrir ce message
          </Link>
        </div>
      </details>
    );
  }
  return <AnimatedEmojiText text={item.presentation?.kind==='TEXT'?item.presentation.text:item.content}/>;
}

export function ConversationView({conversationId,embedded=false,onClose}:{conversationId:string;embedded?:boolean;onClose?:()=>void}) {
  const router=useRouter();
  const {user,loading:sessionLoading}=useSession({required:true});
  const {locale}=useI18n();
  const en=locale==='en';
  const [searchOpen,setSearchOpen]=useState(false);
  const [searchTerm,setSearchTerm]=useState('');
  const [menuOpen,setMenuOpen]=useState(false);
  const [expressionLayout,setExpressionLayout]=useState<'closed'|'compact'|'expanded'>('closed');
  const [voiceRequest,setVoiceRequest]=useState(0);
  const [recordingVoice,setRecordingVoice]=useState(false);
  const [targetMessage,setTargetMessage]=useState('');
  const [shareNotice,setShareNotice]=useState('');
  const soughtCursors=useRef<Set<string>>(new Set());
  const socket=useMemo(()=>getRealtimeSocket(),[]);
  const userIdRef=useRef<string|null>(null);
  const typingTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const typingActive=useRef(false);

  const [items,setItems]=useState<Message[]>([]);
  const [readStates,setReadStates]=useState<ReadState[]>([]);
  const [chatSummary,setChatSummary]=useState<ChatSummary|null>(null);
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
    setTargetMessage(new URLSearchParams(window.location.search).get('message')??'');
    soughtCursors.current.clear();
  },[conversationId]);

  useEffect(()=>{
    if(!targetMessage || sessionLoading || refreshing || loadingOlder)return;
    const element=document.getElementById(`knowme-message-${targetMessage}`);
    if(element){
      element.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    if(!nextCursor||soughtCursors.current.size>=100)return;
    if(!soughtCursors.current.has(nextCursor)){
      soughtCursors.current.add(nextCursor);
      void load(nextCursor);
    }
  },[targetMessage,items,nextCursor,sessionLoading,refreshing,loadingOlder,load]);

  async function copyContentLink(kind:'message'|'conversation',id:string){
    try{
      await navigator.clipboard.writeText(
        buildKnowMePublicLink({kind,id})
      );
      setShareNotice(en?'Link copied':'Lien copié');
    }catch{
      setShareNotice(en?'Copy not available':'Copie indisponible');
    }
  }

  useEffect(() => {
    if (sessionLoading || !user) return;
    let active = true;
    // Keep the group title and member count in sync with the official chat list.
    void apiFetch<ChatSummary[]>('/conversations')
      .then(chats => { if (active) setChatSummary(chats.find(chat=>chat.id===conversationId) ?? null); })
      .catch(() => { if (active) setChatSummary(null); });
    return () => { active = false; };
  }, [conversationId, user?.id, sessionLoading]);


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
    const onRemoved=(event:{conversationId:string})=>{
      if(event.conversationId===conversationId)router.replace('/messages');
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
    socket.on('conversation:removed',onRemoved);

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
      socket.off('conversation:removed',onRemoved);
    };
  },[conversationId,markRead,sessionLoading,socket,user,router]);

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
  const peer=peers.length===1?peers[0].user:null;
  const isGroup=chatSummary?.isGroup ?? readStates.length>2;
  const chatTitle=isNexusPrivate?'Nexus':chatSummary?.title||(isGroup
    ? (en?'Group chat':'Discussion de groupe')
    : peers.map(peer=>peer.user.displayName).join(', ')||(en?'Conversation':'Conversation'));
  const infoHref=`/messages/${encodeURIComponent(conversationId)}/info`;
  const visibleMessages=searchTerm.trim()
    ? items.filter(item=>(item.presentation?.kind==='TEXT'?item.presentation.text:item.content).toLocaleLowerCase().includes(searchTerm.trim().toLocaleLowerCase()))
    : items;

  const ScreenTag = embedded ? 'section' : 'main';
  return(
    <ScreenTag className={`${embedded?'km-chat-screen km-chat-embedded':'km-chat-screen'} ${referenceStyles.chat} ${expressionLayout==='compact'?referenceStyles.panelCompact:expressionLayout==='expanded'?referenceStyles.panelExpanded:''}`} aria-label={en?'Conversation':'Discussion'}>
      <header className="km-chat-header">
        {embedded&&onClose
          ? <button type="button" onClick={onClose} className="km-action km-chat-back" aria-label={en?'Close conversation':'Fermer la discussion'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>
            </button>
          : <Link href="/messages" className="km-action km-chat-back" aria-label={en?'Back to chats':'Retour aux discussions'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>
            </Link>}
        <Link href={infoHref} className={`km-chat-avatar km-chat-profile-trigger ${isNexusPrivate?'km-chat-ai':''}`}
          aria-label={en?'Open conversation information':'Voir les informations de la discussion'}>
          {isNexusPrivate ? 'N'
            : isGroup
              ? <span className="km-chat-avatar-stack" aria-hidden="true">
                {peers.slice(0,3).map(member => <span key={member.userId}>
                  {member.user.avatarUrl ? <img src={member.user.avatarUrl} alt="" /> :
                    (Array.from(member.user.displayName)[0]||'?').toLocaleUpperCase()}
                </span>)}
              </span>
              : peer?.avatarUrl
                ? <img src={peer.avatarUrl} alt="" className="km-chat-avatar-image" />
                : (Array.from(peer?.displayName||'D')[0]||'D').toLocaleUpperCase()}
        </Link>
        <Link href={infoHref} className="km-chat-header-details km-chat-profile-trigger"
          aria-label={en?'Open conversation information':'Voir les informations de la discussion'}>
          <h1 style={{display:'flex',alignItems:'center',gap:5}}>{chatTitle}{peer?.staff?.shield==='GOLD'&&!isGroup?<AccountBadges staff={peer.staff} compact/>:null}</h1>
          <p>
            {isNexusPrivate ? (en?'KnowMe assistant':'Assistant KnowMe')
              : isGroup ? `${readStates.length} ${en?'members':'membres'}`
              : socketStatus==='connected'
                ? peers.some(member=>onlineUserIds.has(member.userId))?(en?'Online':'En ligne'):(en?'Connected':'Connecté')
                : socketStatus==='connecting'?(en?'Connecting…':'Connexion…'):(en?'Waiting for network':'En attente du réseau')}
          </p>
        </Link>
        <button className="km-action km-reference-call-action" type="button" aria-label={en?'Video call':'Appel vidéo'}
          onClick={()=>{window.location.assign(`/calls?peer=${encodeURIComponent(peer?.id??'')}&media=video`);}}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
            <rect x="2.5" y="4.8" width="15.2" height="14.3" rx="2.2"/><path d="m17.7 9 4-2v10l-4-2"/>
          </svg>
        </button>
        <button className="km-action km-reference-call-action" type="button" aria-label={en?'Voice call':'Appel vocal'}
          onClick={()=>{window.location.assign(`/calls?peer=${encodeURIComponent(peer?.id??'')}&media=audio`);}}>
          <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
            <path d="m4.6 3 4.5 1.5L9.7 9l-2.4 1.8a18 18 0 0 0 5.9 5.9l1.8-2.4 4.5.6L21 19.4c.2 1.1-.7 2-1.8 1.8A19 19 0 0 1 2.8 4.8c-.2-1.1.7-2 1.8-1.8Z"/>
          </svg>
        </button>
        <div className="km-chat-menu-anchor">
          <button className="km-action" type="button" aria-expanded={menuOpen} aria-haspopup="menu"
            aria-label={en?'Conversation options':'Options de la discussion'}
            onClick={()=>{setMenuOpen(value=>!value);setSearchOpen(false);}}>
            <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
          </button>
          {menuOpen&&<div className="km-chat-context-menu" role="menu">
            <Link role="menuitem" href={infoHref} onClick={()=>setMenuOpen(false)}>
              {en?'Chat information':'Informations de la discussion'}
            </Link>
            {peer&&<Link role="menuitem" href={`/profile/${encodeURIComponent(peer.username)}`}
              onClick={()=>setMenuOpen(false)}>{en?'View profile':'Voir le profil'}</Link>}
            <button role="menuitem" type="button" onClick={()=>{setMenuOpen(false);setSearchOpen(true);}}>
              {en?'Search messages':'Rechercher des messages'}
            </button>
            <button role="menuitem" type="button" onClick={()=>{setMenuOpen(false);void copyContentLink('conversation',conversationId);}}>{en?'Copy conversation link':'Copier le lien de la discussion'}</button>
            <Link role="menuitem" href="/saved-messages" onClick={()=>setMenuOpen(false)}>
              {en?'Saved messages':'Messages enregistrés'}
            </Link>
          </div>}
        </div>
      </header>
      {searchOpen&&<div className="km-chat-inline-search">
        <input autoFocus type="search" value={searchTerm} onChange={event=>setSearchTerm(event.target.value)}
          placeholder={en?'Search in this chat':'Rechercher dans cette discussion'}
          aria-label={en?'Search messages':'Rechercher des messages'}/>
        <button type="button" onClick={()=>{setSearchTerm('');setSearchOpen(false);}}
          aria-label={en?'Close search':'Fermer la recherche'}>×</button>
      </div>}
      {message&&<p className="km-auth-error" role="alert" style={{margin:'10px 20px'}}>{message}</p>}
      {shareNotice&&<p role="status" style={{margin:'10px 20px'}}>{shareNotice}</p>}
      <section className="km-chat-transcript" aria-label={en?'Chat messages':'Messages de la conversation'}>
        {nextCursor&&<button className="km-history-button" disabled={loadingOlder} onClick={()=>void load(nextCursor)}>{loadingOlder?(en?'Loading…':'Chargement…'):(en?'Load older messages':'Afficher les messages précédents')}</button>}
        {visibleMessages.map((item,index)=>{
          const mine=item.senderId===user?.id;
          const nexus=item.nexusAuthored===true;
          const previous=visibleMessages[index-1];
          const showDay=index===0||new Date(previous!.createdAt).toDateString()!==new Date(item.createdAt).toDateString();
          const date=new Date(item.createdAt);
          const today=new Date();
          const dateLabel=date.toDateString()===today.toDateString()?(en?'Today':'Aujourd’hui'):
            date.toDateString()===new Date(today.getTime()-86400000).toDateString()?(en?'Yesterday':'Hier'):
              date.toLocaleDateString(en?'en-US':'fr-FR',{day:'numeric',month:'short'});
          const readers=mine?readStates.filter(state=>
            state.userId!==user?.id&&new Date(state.lastReadAt).getTime()>=new Date(item.createdAt).getTime()
          ):[];
          return <div key={item.id} className="km-reference-message-row">
            {showDay?<span className="km-reference-day">{dateLabel}</span>:null}
            <article id={`knowme-message-${item.id}`} className={`km-message-bubble ${mine?'km-message-mine':nexus?'km-message-nexus':'km-message-other'}`} style={{scrollMarginTop:90,outline:targetMessage===item.id?'2px solid var(--mint)':undefined}}>
            {!mine&&(nexus||isGroup)&&(nexus
              ? <strong className="km-message-author">Nexus</strong>
              : <Link className="km-message-author" href={`/profile/${encodeURIComponent(item.sender.username)}`} aria-label={`Voir le profil de ${item.sender.displayName}`}>{item.sender.displayName}<AccountBadges staff={item.sender.staff} compact/></Link>
            )}
            <MessageContent item={item}/>
            <div className="km-message-meta">
              <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString(en?'en-US':'fr-FR',{hour:'2-digit',minute:'2-digit'})}</time>
              {mine&&<span aria-label={readers.length>0?(en?'Read':'Lu'):(en?'Sent':'Envoyé')} className={readers.length?'km-reference-read':'km-reference-sent'}>{readers.length?'✓✓':'✓'}</span>}
            </div>
            </article>
          </div>;
        })}
        {!visibleMessages.length&&<div className="km-chat-transcript-empty">{searchTerm.trim()?(en?'No matching messages':'Aucun message correspondant'):(en?'Say hello to start the conversation.':'Dis bonjour pour commencer la conversation.')}</div>}
        {nexusPending&&<p className="km-typing-indicator" aria-live="polite">{en?'Nexus is thinking':'Nexus réfléchit'}<span aria-hidden="true">…</span></p>}
        {typingNames.length>0&&<p className="km-typing-indicator" aria-live="polite">{typingNames.join(', ')} {en?'typing…':typingNames.length>1?'écrivent…':'écrit…'}</p>}
      </section>
      <form className="km-chat-composer" onSubmit={send}>
        <StickerPicker<Message> conversationId={conversationId} onSent={acceptSent}
          referenceChat draftHasText={Boolean(draft.trim())} onPanelChange={setExpressionLayout}
          voiceRequest={voiceRequest} onRecordingChange={setRecordingVoice}
          onInsertEmoji={emoji=>changeDraft(draft+emoji)}
          inputSlot={<input className="km-chat-compose-input" value={draft} onChange={event=>changeDraft(event.target.value)}
            onBlur={stopTyping} maxLength={2000} placeholder={isNexusPrivate?(en?'Message Nexus':'Message à Nexus'):'Message'}
            autoComplete="off" aria-label={en?'Your message':'Votre message'}/>}
        />
        {draft.trim()?<button className="km-send-button" disabled={sending||nexusPending}
          aria-label={sending?(en?'Sending message':'Envoi du message'):(en?'Send message':'Envoyer le message')}>
          {sending?<span className="km-spinner" aria-hidden="true"/>:
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14m-6-6 6 6-6 6"/>
            </svg>}
        </button>:<button type="button" className={`km-send-button km-reference-microphone ${recordingVoice?'km-reference-mic-recording':''}`}
          aria-label={recordingVoice?(en?'Stop recording and send':'Arrêter et envoyer le vocal'):(en?'Record a voice message':'Enregistrer un message vocal')}
          onClick={()=>setVoiceRequest(value=>value+1)}>
          {recordingVoice?<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>:<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5.7 10a6.3 6.3 0 0 0 12.6 0M12 16.5V22m-4 0h8"/>
          </svg>}
        </button>}
      </form>
    </ScreenTag>
  );
}

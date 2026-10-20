'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {apiFetch} from '../../lib/api';
import './reel-share-sheet.css';

type SharePost={
  id:string;
  author:{username:string;displayName:string};
  content:string;
};
type Chat={
  id:string;
  title?:string|null;
  isGroup?:boolean;
  avatarUrl?:string|null;
  members?:Array<{userId:string;user?:{
    id:string;displayName?:string|null;username?:string|null;avatarUrl?:string|null
  }|null}>;
};
type IconName='repost'|'story'|'copy'|'apps'|'close'|'search'|'hide'|'post'|'send'|'flag';

function Glyph({name}:{name:IconName}){
  const base={width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',
    strokeWidth:2,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const};
  if(name==='repost')return <svg {...base}><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>;
  if(name==='story')return <svg {...base}><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 7v10M7 12h10"/></svg>;
  if(name==='copy')return <svg {...base}><path d="M9 15a4 4 0 0 0 6 .2l3.2-3.2a4 4 0 0 0-5.7-5.7L11 8"/><path d="M15 9a4 4 0 0 0-6-.2l-3.2 3.2a4 4 0 1 0 5.7 5.7L13 16"/></svg>;
  if(name==='apps')return <svg {...base}><path d="M12 3v13m0 0-5-5m5 5 5-5M5 18v3h14v-3"/></svg>;
  if(name==='search')return <svg {...base}><circle cx="10.8" cy="10.8" r="7.5"/><path d="m16.7 16.7 4.3 4.3"/></svg>;
  if(name==='close')return <svg {...base}><path d="M5 5l14 14M19 5 5 19"/></svg>;
  if(name==='hide')return <svg {...base}><path d="M3 3 21 21M10.6 5.1a10 10 0 0 1 11 6.9s-3.7 7-9.6 7c-2.1 0-4-.7-5.6-2"/><path d="M2.4 12S6 5 12 5m-1.1 5.9a2 2 0 0 0 2.2 2.2"/></svg>;
  if(name==='post')return <svg {...base}><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>;
  if(name==='flag')return <svg {...base}><path d="M4 21V4m0 1c6-4 10 4 16 0v12c-6 4-10-4-16 0"/></svg>;
  return <svg {...base}><path d="m21 3-9.5 18-2.3-7.2L2 11.5 21 3Z"/><path d="M9.2 13.8 21 3"/></svg>;
}

function getName(chat:Chat,en:boolean,viewerId?:string){
  if(chat.title?.trim())return chat.title.trim();
  const others=(chat.members??[])
    .filter(member=>!viewerId||member.userId!==viewerId)
    .map(member=>member.user?.displayName?.trim()||member.user?.username?.trim()||'')
    .filter(Boolean);
  return others.join(', ')||(chat.isGroup?(en?'Group':'Groupe'):(en?'Conversation':'Discussion'));
}

function getPhoto(chat:Chat,viewerId?:string){
  const url=chat.avatarUrl||(chat.members??[])
    .filter(member=>!viewerId||member.userId!==viewerId)
    .map(member=>member.user?.avatarUrl).find(Boolean);
  return url&&/^https:\/\//i.test(url)?url:null;
}

export function ReelShareSheet({post,viewerId,en,onClose,onHide}:{
  post:SharePost;viewerId?:string;en:boolean;onClose:()=>void;onHide:()=>void
}){
  const [chats,setChats]=useState<Chat[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState('');
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [chooseStory,setChooseStory]=useState(false);
  const [confirmRepost,setConfirmRepost]=useState(false);
  const [reportOpen,setReportOpen]=useState(false);
  const [reportReason,setReportReason]=useState('');
  const inflight=useRef(false);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  const sheet=useRef<HTMLElement>(null);
  const opener=useRef<HTMLElement|null>(null);
  const url=useMemo(()=>typeof window==='undefined'?'':window.location.origin+
    '/feed/'+encodeURIComponent(post.id),[post.id]);
  const creator=post.author.displayName||'@'+post.author.username;
  const visible=useMemo(()=>chats.filter(chat=>
    getName(chat,en,viewerId).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ),[chats,query,en,viewerId]);

  useEffect(()=>{
    opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const first=sheet.current?.querySelector<HTMLButtonElement>('.km-reel-share-close');
    first?.focus();
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){if(!inflight.current)closeRef.current();return;}
      if(event.key!=='Tab')return;
      const elements=Array.from(sheet.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],select:not(:disabled)'
      )??[]).filter(element=>element.getClientRects().length);
      if(!elements.length)return;
      const index=elements.indexOf(document.activeElement as HTMLElement);
      if(event.shiftKey&&(index<=0)){event.preventDefault();elements[elements.length-1]?.focus();}
      else if(!event.shiftKey&&index===elements.length-1){event.preventDefault();elements[0]?.focus();}
    };
    document.addEventListener('keydown',keydown);
    return()=>{
      document.removeEventListener('keydown',keydown);
      document.body.style.overflow=oldOverflow;
      opener.current?.focus();
    };
  },[]);

  useEffect(()=>{
    let alive=true;
    setLoading(true);setLoadError('');
    void apiFetch<Chat[]>('/conversations').then(result=>{
      if(!alive)return;
      if(!Array.isArray(result))throw new Error(en?'Conversations unavailable':'Conversations indisponibles');
      setChats(result);
    }).catch(cause=>{
      if(!alive)return;
      setChats([]);
      setLoadError(cause instanceof Error?cause.message:
        (en?'Could not load conversations':'Chargement des discussions impossible'));
    }).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[post.id,en]);

  async function send(){
    if(inflight.current||!selected)return;
    const target=chats.find(chat=>chat.id===selected);
    if(!target)return;
    const content=[note.trim(),creator+' · KnowMe',url].filter(Boolean).join('\n\n');
    if(content.length>4000){setError(en?'Message too long.':'Message trop long.');return;}
    inflight.current=true;setBusy(true);setError('');
    try{
      await apiFetch('/conversations/'+encodeURIComponent(target.id)+'/messages',{
        method:'POST',body:JSON.stringify({content})
      });
      closeRef.current();
    }catch(cause){
      const code=(cause as {code?:string})?.code;
      setError(code==='KNOWME_TIMEOUT'||code==='KNOWME_NETWORK_UNAVAILABLE'?
        (en?'Delivery uncertain. Check chat before retrying.':'Envoi incertain. Vérifie la discussion avant de réessayer.'):
        cause instanceof Error?cause.message:(en?'Send failed.':'Envoi impossible.'));
    }finally{inflight.current=false;setBusy(false);}
  }

  async function publish(kind:'repost'|'story',audience:'FRIENDS'|'PUBLIC'='FRIENDS'){
    if(inflight.current)return;
    inflight.current=true;setBusy(true);setError('');setNotice('');
    try{
      if(kind==='repost')await apiFetch('/posts',{method:'POST',body:JSON.stringify({
        content:creator+' · KnowMe\n\n'+url
      })});
      else await apiFetch('/stories',{method:'POST',body:JSON.stringify({
        type:'LINK',linkUrl:url,audience,durationHours:24,
        allowSharing:true,allowReplies:true,allowReactions:true
      })});
      closeRef.current();
    }catch(cause){
      setError(cause instanceof Error?cause.message:
        (en?'Publication failed.':'Publication impossible.'));
    }finally{inflight.current=false;setBusy(false);}
  }

  async function submitReport(){
    const reason=reportReason.trim();
    if(inflight.current||reason.length<5||reason.length>500)return;
    inflight.current=true;setBusy(true);setError('');setNotice('');
    try{
      await apiFetch('/reports',{method:'POST',body:JSON.stringify({
        targetType:'POST',targetId:post.id,reason
      })});
      setReportReason('');setReportOpen(false);
      setNotice(en?'Your report was submitted.':'Signalement envoyé.');
    }catch(cause){
      setError(cause instanceof Error?cause.message:(en?'Could not submit report.':'Signalement impossible.'));
    }finally{inflight.current=false;setBusy(false);}
  }

  async function copy(){
    try{await navigator.clipboard.writeText(url);setNotice(en?'Link copied.':'Lien copié.');}
    catch{setError(en?'Clipboard unavailable.':'Presse-papiers indisponible.');}
  }

  async function shareOutside(){
    try{
      if(navigator.share)await navigator.share({title:creator+' · KnowMe',url});
      else await copy();
    }catch(cause){
      if((cause as Error)?.name!=='AbortError')
        setError(en?'Sharing unavailable.':'Partage indisponible.');
    }
  }

  return <div className="km-reel-share-backdrop" onMouseDown={event=>{
    if(event.target===event.currentTarget&&!inflight.current)closeRef.current();
  }}>
    <section ref={sheet} className="km-reel-share-dialog" role="dialog" aria-modal="true"
      aria-label={en?'Share Reel':'Partager le Reel'}>
      <div className="km-reel-share-handle" aria-hidden="true"/>
      <header className="km-reel-share-heading">
        <strong>{en?'Send to':'Envoyer à'}</strong>
        <button className="km-reel-share-close" type="button" disabled={busy}
          aria-label={en?'Close':'Fermer'} onClick={onClose}><Glyph name="close"/></button>
      </header>
      <div className="km-reel-share-content">
        <label className="km-reel-share-search">
          <Glyph name="search"/>
          <input value={query} onChange={event=>setQuery(event.target.value)}
            placeholder={en?'Search friends or groups':'Rechercher des amis ou groupes'}
            aria-label={en?'Search conversations':'Rechercher des discussions'}/>
        </label>
        {loading?<p className="km-reel-share-muted" role="status">{en?'Loading conversations…':'Chargement des discussions…'}</p>:
          loadError?<p role="alert" className="km-reel-share-error">{loadError}</p>:
          visible.length?<div className="km-reel-share-contacts">
            {visible.map(chat=>{
              const name=getName(chat,en,viewerId);
              const photo=getPhoto(chat,viewerId);
              return <button key={chat.id} type="button" disabled={busy}
                className={'km-reel-share-contact'+(selected===chat.id?' is-selected':'')}
                aria-label={name} aria-pressed={selected===chat.id}
                onClick={()=>setSelected(current=>current===chat.id?'':chat.id)}>
                <span className="km-reel-share-avatar">
                  {photo?<img src={photo} alt="" loading="lazy"/>:
                    <span>{name.charAt(0).toLocaleUpperCase()||'?'}</span>}
                </span><span className="km-reel-share-contact-name">{name}</span>
              </button>;
            })}
          </div>:<p className="km-reel-share-muted">
            {query?(en?'No matching conversations.':'Aucune discussion trouvée.'):
              (en?'No conversations available.':'Aucune discussion disponible.')}
          </p>}
        {selected&&<form className="km-reel-share-send" onSubmit={event=>{event.preventDefault();void send();}}>
          <input value={note} maxLength={3500} onChange={event=>setNote(event.target.value)}
            placeholder={en?'Add a message (optional)':'Ajouter un message (facultatif)'}/>
          <button type="submit" disabled={busy}><Glyph name="send"/>{en?'Send':'Envoyer'}</button>
        </form>}
        <div className="km-reel-share-divider"/>
        <h3>{en?'Share':'Partager'}</h3>
        <div className="km-reel-share-grid">
          <button type="button" disabled={busy} onClick={()=>{setChooseStory(false);setConfirmRepost(true);}}>
            <span><Glyph name="repost"/></span>{en?'Repost':'Republier'}
          </button>
          <button type="button" disabled={busy} onClick={()=>{setConfirmRepost(false);setChooseStory(true);}}>
            <span><Glyph name="story"/></span>{en?'My Story':'Ma Story'}
          </button>
          <button type="button" disabled={busy} onClick={()=>{void copy();}}>
            <span><Glyph name="copy"/></span>{en?'Copy link':'Copier le lien'}
          </button>
          <button type="button" disabled={busy} onClick={()=>{void shareOutside();}}>
            <span><Glyph name="apps"/></span>{en?'Other apps':'Autres applis'}
          </button>
        </div>
        {confirmRepost&&<div className="km-reel-share-confirm">
          <p>{en?'A public post will link to the original Reel.':'Une publication publique contiendra un lien vers le Reel original.'}</p>
          <div><button type="button" onClick={()=>setConfirmRepost(false)}>{en?'Cancel':'Annuler'}</button>
            <button type="button" disabled={busy} onClick={()=>{void publish('repost');}}>{en?'Confirm repost':'Confirmer'}</button></div>
        </div>}
        {chooseStory&&<div className="km-reel-share-confirm">
          <p>{en?'Who can view this Story?':'Qui peut voir cette Story ?'}</p>
          <div><button type="button" disabled={busy} onClick={()=>{void publish('story','FRIENDS');}}>
            {en?'Friends':'Amis'}</button>
            <button type="button" disabled={busy} onClick={()=>{void publish('story','PUBLIC');}}>
              {en?'Public':'Public'}</button>
            <button type="button" onClick={()=>setChooseStory(false)}>{en?'Cancel':'Annuler'}</button></div>
        </div>}
        <div className="km-reel-share-divider"/>
        <h3>{en?'Reel options':'Options du Reel'}</h3>
        <Link className="km-reel-share-option" href={'/feed/'+encodeURIComponent(post.id)}
          onClick={onClose}><Glyph name="post"/>{en?'View original post':'Voir la publication'}</Link>
        <button className="km-reel-share-option" type="button" disabled={busy}
          onClick={onHide}><Glyph name="hide"/>{en?'Hide this Reel here':'Masquer ce Reel ici'}</button>
        <button className="km-reel-share-option" type="button" disabled={busy}
          aria-expanded={reportOpen} onClick={()=>{setReportOpen(value=>!value);setError('');}}>
          <Glyph name="flag"/>{en?'Report this Reel':'Signaler ce Reel'}
        </button>
        {reportOpen&&<form className="km-reel-share-report" onSubmit={event=>{
          event.preventDefault();void submitReport();
        }}>
          <p>{en?'Why are you reporting it?':'Quel est le motif du signalement ?'}</p>
          {(en?['Spam or scam','Harassment or threats','Violent or dangerous content']:
            ['Spam ou arnaque','Harcèlement ou menaces','Contenu violent ou dangereux']).map(reason=>
              <button key={reason} type="button" disabled={busy}
                aria-pressed={reportReason===reason}
                onClick={()=>setReportReason(reason)}>{reason}</button>)}
          <textarea maxLength={500} value={reportReason} onChange={event=>setReportReason(event.target.value)}
            placeholder={en?'Describe the issue (5–500 characters)':'Décris le problème (5 à 500 caractères)'}
            aria-label={en?'Report reason':'Motif du signalement'}/>
          <button className="km-reel-share-report-send" type="submit"
            disabled={busy||reportReason.trim().length<5}>
            {en?'Submit report':'Envoyer le signalement'}
          </button>
        </form>}
        <p className="km-reel-share-muted">
          {en?'Hiding applies only to this loaded feed, not recommendations.':
            'Le masquage concerne uniquement ce fil chargé, pas les recommandations.'}
        </p>
        {notice&&<p role="status" className="km-reel-share-success">{notice}</p>}
        {error&&<p role="alert" className="km-reel-share-error">{error}</p>}
        {busy&&<p role="status" className="km-reel-share-muted">
          {en?'Please wait…':'Opération en cours…'}
        </p>}
      </div>
    </section>
  </div>;
}

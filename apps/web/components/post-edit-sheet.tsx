'use client';

import {useEffect,useRef,useState} from 'react';
import {apiFetch} from '../lib/api';
import { KnowMeAnimatedIcon } from './knowme-animated-icon';
import { KnowMeIconButton } from './knowme-icon-button';

export function PostEditSheet({post,en,onClose,onSaved}:{
  post:{id:string;content:string;hasMedia:boolean};
  en:boolean;
  onClose:()=>void;
  onSaved:(content:string)=>void;
}){
  const [text,setText]=useState(post.content);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const inflight=useRef(false);
  const valid=(text.trim().length>0||post.hasMedia)&&text!==post.content;
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!inflight.current)onClose();};
    window.addEventListener('keydown',escape);
    return ()=>window.removeEventListener('keydown',escape);
  },[onClose]);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!valid||inflight.current)return;
    inflight.current=true;setBusy(true);setError('');
    try{
      const edited=await apiFetch<{content:string}>('/posts/'+encodeURIComponent(post.id),{
        method:'PATCH',body:JSON.stringify({content:text})
      });
      onSaved(edited.content);
      onClose();
    }catch(cause){
      const e=cause as {code?:string;message?:string};
      const uncertain=e.code==='KNOWME_TIMEOUT'||e.code==='KNOWME_NETWORK_UNAVAILABLE';
      setError(uncertain
        ?(en?'Edit not confirmed. Check the post before trying again.':
            'Modification non confirmée. Vérifie la publication avant de recommencer.')
        :cause instanceof Error?cause.message:(en?'Edit failed.':'Modification impossible.'));
    }finally{inflight.current=false;setBusy(false);}
  }
  return <div className="km-post-options-overlay" role="presentation"
    onMouseDown={event=>{
      if(event.currentTarget===event.target&&!busy)onClose();
    }}>
    <form className="km-post-options-sheet km-post-edit-sheet"
      role="dialog" aria-modal="true"
      aria-label={en?'Edit publication':'Modifier la publication'}
      onSubmit={event=>void submit(event)}>
      <div className="km-post-options-handle" aria-hidden="true"/>
      <header>
        <h2>{en?'Edit publication':'Modifier la publication'}</h2>
        <KnowMeIconButton name="close" size={20}
          disabled={busy} onClick={onClose}
          label={en?'Cancel edit':'Annuler la modification'}/>
      </header>
      <p>{en?'Existing photos and videos stay attached.':'Les photos et vidéos déjà publiées restent jointes.'}</p>
      <label htmlFor="knowme-edit-post-text">{en?'Text of the post':'Texte de la publication'}</label>
      <textarea id="knowme-edit-post-text" value={text} onChange={event=>setText(event.target.value)}
        disabled={busy} rows={7} autoFocus/>
      <small>{text.length} {en?'characters':'caractères'}</small>
      {error&&<p role="alert">{error}</p>}
      <div className="km-post-edit-actions">
        <button type="button" disabled={busy} onClick={onClose}>{en?'Cancel':'Annuler'}</button>
        <button type="submit" disabled={!valid||busy}>
          <KnowMeAnimatedIcon name={busy ? 'refresh' : 'check'}
            state={busy ? 'loading' : 'idle'} size={19}/>
          {busy?(en?'Saving…':'Enregistrement…'):(en?'Save':'Enregistrer')}
        </button>
      </div>
    </form>
  </div>;
}

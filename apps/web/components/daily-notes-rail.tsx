'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useI18n } from './i18n-provider';

type DailyNote = {
  userId: string;
  content: string;
  expiresAt: string;
  user: {id:string;displayName:string;username:string;avatarUrl?:string|null};
};

export function DailyNotesRail({userId}:{userId:string}) {
  const {locale}=useI18n();
  const en=locale==='en';
  const [notes,setNotes]=useState<DailyNote[]>([]);
  const [draft,setDraft]=useState('');
  const [editing,setEditing]=useState(false);
  const [selected,setSelected]=useState<DailyNote|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [now,setNow]=useState(Date.now());

  const refresh=useCallback(async()=>{
    const incoming=await apiFetch<DailyNote[]>('/daily-notes');
    setNotes(incoming.filter(note=>Date.parse(note.expiresAt)>Date.now()));
    setError('');
  },[]);

  useEffect(()=>{
    let active=true;
    void apiFetch<DailyNote[]>('/daily-notes')
      .then(items=>{if(active)setNotes(items.filter(note=>Date.parse(note.expiresAt)>Date.now()));})
      .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Pensées indisponibles.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[userId]);

  useEffect(()=>{
    const tick=setInterval(()=>setNow(Date.now()),30_000);
    const visible=()=>{
      if(document.visibilityState==='visible'){
        setNow(Date.now());
        void refresh().catch(()=>undefined);
      }
    };
    document.addEventListener('visibilitychange',visible);
    return()=>{clearInterval(tick);document.removeEventListener('visibilitychange',visible);};
  },[refresh]);

  const activeNotes=notes.filter(note=>Date.parse(note.expiresAt)>now);
  const mine=activeNotes.find(item=>item.userId===userId);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const content=draft.trim();
    if(!content||busy)return;
    setBusy(true);setError('');
    try{
      await apiFetch('/daily-notes/mine',{method:'PUT',body:JSON.stringify({content})});
      await refresh();
      setEditing(false);
    }catch(cause){setError(cause instanceof Error?cause.message:'Publication impossible.');}
    finally{setBusy(false);}
  }
  async function remove(){
    if(busy)return;
    setBusy(true);setError('');
    try{
      await apiFetch('/daily-notes/mine',{method:'DELETE'});
      await refresh();
      setEditing(false);
    }catch(cause){setError(cause instanceof Error?cause.message:'Suppression impossible.');}
    finally{setBusy(false);}
  }

  return <section aria-label={en?'Daily thoughts':'Pensées du jour'}
    style={{margin:'9px 0 16px',minWidth:0}}>
    <div style={{display:'flex',gap:9,alignItems:'baseline',marginBottom:10,padding:'0 3px'}}>
      <strong style={{fontSize:15}}>{en?'Daily thoughts':'Pensées du jour'}</strong>
      <small style={{color:'var(--muted)'}}>24 h · {en?'Friends only':'Entre amis'}</small>
    </div>
    {loading&&<small role="status" style={{color:'var(--muted)'}}>{en?'Loading…':'Chargement…'}</small>}
    <div style={{display:'flex',gap:13,overflowX:'auto',padding:'2px 4px 10px',scrollSnapType:'x proximity'}}>
      <button type="button" aria-label={en?'Write your thought':'Écrire ma pensée'}
        onClick={()=>{setDraft(mine?.content??'');setEditing(true);}}
        style={{flex:'0 0 80px',scrollSnapAlign:'start',display:'grid',justifyItems:'center',alignContent:'start',
          gap:5,border:0,background:'none',color:'inherit',cursor:'pointer',padding:0}}>
        <span style={{width:58,height:58,borderRadius:'50%',display:'grid',placeItems:'center',
          border:'1.5px solid var(--mint)',background:'var(--surface-glass)',fontSize:24}}>+</span>
        <strong style={{maxWidth:80,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11}}>
          {en?'My thought':'Ma pensée'}
        </strong>
        <small style={{color:'var(--muted)',textAlign:'center',fontSize:10,lineHeight:'13px',
          display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
          {mine?.content??(en?'Add note':'Ajouter')}
        </small>
      </button>
      {activeNotes.filter(item=>item.userId!==userId).map(note=>
        <button type="button" key={note.userId} onClick={()=>setSelected(note)}
          aria-label={note.user.displayName+' : '+note.content}
          style={{flex:'0 0 80px',scrollSnapAlign:'start',display:'grid',justifyItems:'center',alignContent:'start',
            gap:5,border:0,background:'none',color:'inherit',cursor:'pointer',padding:0}}>
          <span style={{width:58,height:58,borderRadius:'50%',display:'grid',placeItems:'center',
            border:'1px solid var(--soft-border)',background:'var(--surface-glass)',
            fontSize:21,fontWeight:700,overflow:'hidden'}}>
            {note.user.avatarUrl?
              <img src={note.user.avatarUrl} alt="" width={58} height={58}
                style={{objectFit:'cover',borderRadius:'50%'}}/>:
              note.user.displayName.charAt(0).toUpperCase()}
          </span>
          <strong title={note.user.displayName} style={{maxWidth:80,overflow:'hidden',
            textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11}}>
            {note.user.displayName}
          </strong>
          <small style={{color:'var(--muted)',textAlign:'center',fontSize:10,lineHeight:'13px',
            display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
            {note.content}
          </small>
        </button>
      )}
    </div>
    {error&&<p role="alert" style={{fontSize:12,color:'var(--orange)'}}>{error}</p>}
    {editing&&<div role="presentation" style={{position:'fixed',inset:0,zIndex:1200,
      background:'rgba(0,0,0,.55)',display:'grid',placeItems:'center',padding:15}}
      onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setEditing(false);}}>
      <form onSubmit={save} role="dialog" aria-modal="true"
        aria-label={en?'Write daily thought':'Écrire ma pensée'}
        style={{width:'min(100%,420px)',display:'grid',gap:14,borderRadius:24,padding:22,
          background:'var(--surface)',border:'1px solid var(--soft-border)'}}>
        <h2 style={{fontSize:19,margin:0}}>{en?'Your daily thought':'Ta pensée du jour'}</h2>
        <p style={{fontSize:12,color:'var(--muted)',margin:0}}>
          {en?'Visible to accepted friends for 24 hours. Separate from stories.':
            'Visible par tes amis acceptés pendant 24 heures. Distincte des stories.'}
        </p>
        <textarea className="input" autoFocus maxLength={80} rows={3} required
          value={draft} onChange={e=>setDraft(e.target.value)}
          placeholder={en?'What is on your mind?':'À quoi penses-tu ?'}/>
        <small style={{textAlign:'right',color:'var(--muted)'}}>{draft.length}/80</small>
        <button className="btn btn-primary" type="submit" disabled={busy||!draft.trim()}>
          {busy?(en?'Saving…':'Enregistrement…'):(en?'Share thought':'Publier')}
        </button>
        {mine&&<button type="button" className="btn" disabled={busy}
          onClick={()=>void remove()}>{en?'Delete my thought':'Supprimer ma pensée'}</button>}
        <button type="button" className="btn" disabled={busy} onClick={()=>setEditing(false)}>
          {en?'Cancel':'Annuler'}
        </button>
      </form>
    </div>}
    {selected&&<div role="presentation" style={{position:'fixed',inset:0,zIndex:1200,
      background:'rgba(0,0,0,.5)',display:'grid',placeItems:'center',padding:16}}
      onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
      <div role="dialog" aria-modal="true" aria-label={selected.user.displayName}
        style={{width:'min(100%,370px)',display:'grid',gap:12,padding:22,borderRadius:22,
          background:'var(--surface)',border:'1px solid var(--soft-border)'}}>
        <strong>{selected.user.displayName}</strong>
        <p style={{fontSize:19,overflowWrap:'anywhere'}}>{selected.content}</p>
        <button type="button" className="btn" onClick={()=>setSelected(null)}>
          {en?'Close':'Fermer'}
        </button>
      </div>
    </div>}
  </section>;
}

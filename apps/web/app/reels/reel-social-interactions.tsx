'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {apiFetch} from '../../lib/api';

type FollowSnapshot={following:boolean;isOwner:boolean};
const EMOJIS=['😂','❤️','🔥','😍','👏','😭','👍','✨'];

export function ReelFollowButton({authorId,username,viewerId,en}:{
  authorId:string;username:string;viewerId:string;en:boolean;
}){
  const [following,setFollowing]=useState<boolean|null>(null);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState(false);
  useEffect(()=>{
    if(authorId===viewerId)return;
    let active=true;
    setFollowing(null);setError(false);
    void apiFetch<FollowSnapshot>('/reels/creators/'+encodeURIComponent(authorId)+'/follow-status')
      .then(res=>{if(active){
        if(typeof res?.following!=='boolean'||typeof res?.isOwner!=='boolean'){
          setError(true);return;
        }
        setFollowing(res.isOwner?null:res.following);
      }})
      .catch(()=>{if(active)setError(true);});
    return()=>{active=false;};
  },[authorId,viewerId]);
  if(authorId===viewerId)return null;
  if(error)return <Link className="km-reel-follow" href={'/profile/'+encodeURIComponent(username)}>
    {en?'View profile':'Voir le profil'}
  </Link>;
  return <button className="km-reel-follow" type="button"
    aria-label={following===null?(en?'Checking subscription':'Vérification de l’abonnement'):
      following?(en?'Unfollow':'Ne plus suivre'):(en?'Follow':'Suivre')}
    aria-pressed={Boolean(following)} disabled={following===null||pending}
    onClick={async()=>{
      if(following===null||pending)return;
      setPending(true);
      try{
        await apiFetch('/reels/creators/'+encodeURIComponent(authorId)+'/follow',{
          method:following?'DELETE':'PUT'
        });
        const actual=await apiFetch<FollowSnapshot>(
          '/reels/creators/'+encodeURIComponent(authorId)+'/follow-status');
        setFollowing(actual.following);
      }catch{setFollowing(null);setError(true);}
      finally{setPending(false);}
    }}>
    {pending?'…':following===null?'…':following?(en?'Following':'Abonné'):(en?'Follow':'Suivre')}
  </button>;
}

export function ReelCommentSheet({postId,en,onClose,onSent,onViewAll}:{
  postId:string;en:boolean;onClose:()=>void;onSent:()=>void;onViewAll:()=>void;
}){
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [emojiOpen,setEmojiOpen]=useState(false);
  const input=useRef<HTMLTextAreaElement>(null);
  const sending=useRef(false);
  useEffect(()=>{
    input.current?.focus();
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!sending.current){onClose();}};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[onClose]);
  async function submit(){
    const content=draft.trim();
    if(sending.current||content.length<1||content.length>500)return;
    sending.current=true;setBusy(true);setError('');
    try{
      await apiFetch('/posts/'+encodeURIComponent(postId)+'/comments',{
        method:'POST',body:JSON.stringify({content})
      });
      onSent();
    }catch(cause){
      const code=(cause as {code?:string})?.code;
      setError(code==='KNOWME_TIMEOUT'||code==='KNOWME_NETWORK_UNAVAILABLE'
        ?(en?'Delivery uncertain. Check comments before retrying.':
          'Envoi incertain. Vérifie les commentaires avant de réessayer.')
        :cause instanceof Error?cause.message:
          (en?'Comment could not be published.':'Impossible de publier le commentaire.'));
    }finally{sending.current=false;setBusy(false);}
  }
  return <div className="km-reel-comment-backdrop" onMouseDown={event=>{
    if(event.target===event.currentTarget&&!busy)onClose();
  }}>
    <section className="km-reel-comment-sheet" role="dialog" aria-modal="true"
      aria-label={en?'Write Reel comment':'Rédiger un commentaire'}>
      <div className="km-reel-comment-title">
        <strong>{en?'Add a comment':'Ajouter un commentaire'}</strong>
        <button type="button" onClick={onClose} disabled={busy}
          aria-label={en?'Close':'Fermer'}>×</button>
      </div>
      <textarea ref={input} maxLength={500} value={draft} disabled={busy}
        onChange={event=>setDraft(event.currentTarget.value)}
        placeholder={en?'Write a comment…':'Écris un commentaire…'}
        aria-label={en?'Your comment':'Ton commentaire'} rows={3}/>
      <div className="km-reel-comment-tools">
        <button type="button" aria-label={en?'Mention a person':'Mentionner une personne'}
          disabled={busy} onClick={()=>{setDraft(value=>value+'@');input.current?.focus();}}> @ </button>
        <button type="button" aria-label={en?'Choose emoji':'Choisir un emoji'}
          aria-expanded={emojiOpen} disabled={busy} onClick={()=>setEmojiOpen(s=>!s)}>☺</button>
        <span>{draft.length}/500</span>
        <button className="km-reel-comment-submit" type="button"
          disabled={!draft.trim()||busy} onClick={()=>{void submit();}}>
          {busy?(en?'Sending…':'Envoi…'):(en?'Post':'Publier')}
        </button>
      </div>
      {emojiOpen&&<div className="km-reel-comment-emojis">{EMOJIS.map(emoji=>
        <button key={emoji} type="button" onClick={()=>{setDraft(v=>v+emoji);input.current?.focus();}}
          aria-label={en?'Insert '+emoji:'Insérer '+emoji}>{emoji}</button>)}</div>}
      {error&&<p className="km-reel-comment-error" role="alert">{error}</p>}
      <button className="km-reel-comment-view-all" type="button" disabled={busy}
        onClick={onViewAll}>{en?'View all comments':'Voir tous les commentaires'}</button>
    </section>
  </div>;
}

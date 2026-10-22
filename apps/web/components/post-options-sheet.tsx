'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { KnowMeShareIcon } from './KnowMeShareIcon';

export type PostOption = {
  id: string;
  author: { id: string; username: string; displayName: string };
};

export function PostOptionsSheet({post,own,en,onClose,onShare,onCopy,onEdit,onDelete,onDisinterest}:{
  post:PostOption; own:boolean; en:boolean;onClose:()=>void;
  onShare:()=>void;onCopy:()=>void;onEdit:()=>void;onDelete:()=>void;onDisinterest:()=>void;
}) {
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[onClose]);

  return <div className="km-post-options-overlay" role="presentation"
    onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="km-post-options-sheet" role="dialog" aria-modal="true"
      aria-label={own?(en?'Your post options':'Options de ta publication'):
        (en?'Other post options':'Options de cette publication')}>
      <div className="km-post-options-handle" aria-hidden="true"/>
      <header>
        <h2>{own?(en?'Your publication':'Ta publication'):(en?'Publication options':'Options de la publication')}</h2>
        <button type="button" aria-label={en?'Close':'Fermer'} onClick={onClose}>×</button>
      </header>
      <button type="button" onClick={onShare}>
        <KnowMeShareIcon size={20}/>{en?'Share':'Partager'}
      </button>
      <button type="button" onClick={onCopy}>
        <span aria-hidden="true">⛓</span>{en?'Copy link':'Copier le lien'}
      </button>
      <Link href={`/feed/${encodeURIComponent(post.id)}`} onClick={onClose}>
        <span aria-hidden="true">▤</span>{en?'View publication':'Voir la publication'}
      </Link>
      <Link href={`/profile/${encodeURIComponent(post.author.username)}`} onClick={onClose}>
        <span aria-hidden="true">◯</span>{en?'View profile':'Voir le profil'}
      </Link>
      {own && <button type="button" onClick={onEdit}>
        <span aria-hidden="true">✎</span>{en?'Edit publication':'Modifier la publication'}
      </button>}
      {own ? (
        <button type="button" className="km-post-options-danger" onClick={onDelete}>
          <span aria-hidden="true">×</span>{en?'Delete publication':'Supprimer la publication'}
        </button>
      ) : (
        <button type="button" onClick={onDisinterest}>
          <span aria-hidden="true">−</span>{en?'Hide from my feed':'Masquer de mon fil'}
        </button>
      )}
    </section>
  </div>;
}

export function PostDisinterestSheet({en,onClose,onChoose}:{
  en:boolean;onClose:()=>void;onChoose:(reason:string)=>void;
}) {
  const reasons = en ?
    ['Not interesting','Content is repetitive','Content is disturbing','I see too many posts from this author','Other'] :
    ['Pas intéressant','Contenu répétitif','Contenu dérangeant','Trop de publications de cet auteur','Autre'];
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[onClose]);
  return <div className="km-post-options-overlay" role="presentation"
    onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="km-post-options-sheet" role="dialog" aria-modal="true"
      aria-label={en?'Why hide this publication?':'Pourquoi masquer cette publication ?'}>
      <div className="km-post-options-handle" aria-hidden="true"/>
      <header>
        <h2>{en?'Why hide this publication?':'Pourquoi masquer cette publication ?'}</h2>
        <button type="button" aria-label={en?'Close':'Fermer'} onClick={onClose}>×</button>
      </header>
      <p>{en?'Your choice hides this publication in this session only.':
        'Ce choix masque la publication pour cette session uniquement.'}</p>
      {reasons.map(reason=><button type="button" key={reason}
        onClick={()=>onChoose(reason)}>
        <span aria-hidden="true">○</span>{reason}
      </button>)}
    </section>
  </div>;
}

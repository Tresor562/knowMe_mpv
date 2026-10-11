'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';
import { useI18n } from '../../../components/i18n-provider';
import { PostMediaStrip } from '../../../components/post-media-ui';
import type { PostMedia } from '../../../lib/post-media';

type SavedRecord = {
  id: string;
  createdAt: string;
  post: {
    id: string;
    content: string;
    imageUrl?: string | null;
    attachments?: PostMedia[];
    author: {displayName:string;username:string;avatarUrl?:string|null};
  };
};

export default function SavedPostsPage() {
  const {user,loading:sessionLoading} = useSession({required:true});
  const {locale} = useI18n();
  const en=locale==='en';
  const [records,setRecords]=useState<SavedRecord[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [removing,setRemoving]=useState<string|null>(null);

  useEffect(()=>{
    if(sessionLoading||!user)return;
    let active=true;
    setLoading(true);
    setError('');
    void apiFetch<SavedRecord[]>('/posts/saved')
      .then(items=>{if(active)setRecords(items);})
      .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:
        (en?'Saved posts unavailable.':'Publications enregistrées indisponibles.'));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[sessionLoading,user?.id,en]);

  async function remove(postId:string){
    if(removing)return;
    setRemoving(postId);
    try{
      await apiFetch('/posts/'+encodeURIComponent(postId)+'/save',{method:'DELETE'});
      setRecords(current=>current.filter(item=>item.post.id!==postId));
    }catch(cause){
      setError(cause instanceof Error?cause.message:
        (en?'Unable to remove bookmark.':'Impossible de retirer le favori.'));
    }finally{setRemoving(null);}
  }

  return <main className="shell" style={{maxWidth:770,margin:'0 auto',paddingBottom:115}}>
    <header style={{display:'flex',gap:14,alignItems:'center',marginBottom:18}}>
      <Link className="btn" href="/feed" aria-label={en?'Back to feed':'Retour au fil'}>←</Link>
      <div>
        <h1 style={{margin:0,fontSize:23}}>{en?'Saved posts':'Publications enregistrées'}</h1>
        <small style={{color:'var(--muted)'}}>{en?'Visible only to your account':'Visible uniquement par ton compte'}</small>
      </div>
    </header>
    {(loading||sessionLoading)&&<p role="status">{en?'Loading…':'Chargement…'}</p>}
    {error&&<p role="alert" style={{color:'var(--orange)'}}>{error}</p>}
    {!loading&&!error&&records.length===0&&<p style={{color:'var(--muted)'}}>
      {en?'No saved posts yet.':'Aucune publication enregistrée pour le moment.'}
    </p>}
    <section style={{display:'grid',gap:12}}>
      {records.map(record=><article key={record.id} className="km-feed-post">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {record.post.author.avatarUrl?
            <img src={record.post.author.avatarUrl} alt="" width={44} height={44}
              style={{borderRadius:'50%',objectFit:'cover'}}/>:
            <span style={{display:'grid',placeItems:'center',width:44,height:44,borderRadius:'50%',
              background:'var(--surface-2)'}}>{record.post.author.displayName[0]}</span>}
          <div style={{flex:1,minWidth:0}}>
            <strong style={{display:'block',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
              {record.post.author.displayName}
            </strong>
            <small style={{color:'var(--muted)'}}>@{record.post.author.username}</small>
          </div>
          <button type="button" className="btn" disabled={removing===record.post.id}
            onClick={()=>void remove(record.post.id)}>
            {en?'Unsave':'Retirer'}
          </button>
        </div>
        <Link href={'/feed/'+encodeURIComponent(record.post.id)}>
          <p style={{whiteSpace:'pre-wrap',fontSize:15,lineHeight:1.55}}>
            {record.post.content || (en?'Media post':'Publication multimédia')}
          </p>
        </Link>
        {record.post.imageUrl&&<img src={record.post.imageUrl} alt=""
          style={{width:'100%',maxHeight:320,objectFit:'contain',borderRadius:17}}/>}
        <PostMediaStrip postId={record.post.id} media={record.post.attachments}/>
      </article>)}
    </section>
  </main>;
}

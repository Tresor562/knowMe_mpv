'use client';

import Link from 'next/link';
import {useCallback,useEffect,useState} from 'react';
import {useI18n} from '../../components/i18n-provider';
import {apiFetch} from '../../lib/api';
import {useSession} from '../../lib/use-session';

type SavedPost = {postId:string;createdAt:string};

export default function SavedPostsPage(){
  const {loading:sessionLoading}=useSession({required:true});
  const {locale}=useI18n();
  const en=locale==='en';
  const [items,setItems]=useState<SavedPost[]>([]);
  const [busy,setBusy]=useState(false);
  const [removing,setRemoving]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);

  const refresh=useCallback(async()=>{
    setBusy(true);setError('');
    try{
      const response=await apiFetch<SavedPost[]>('/posts/saved');
      if(!Array.isArray(response))throw new Error('Invalid saved posts response');
      setItems(response);
      setLoaded(true);
    }catch(cause){
      setError(cause instanceof Error?cause.message:(en?'Could not load saved posts.':'Impossible de charger les publications enregistrées.'));
      setLoaded(false);
    }finally{setBusy(false);}
  },[en]);

  useEffect(()=>{if(!sessionLoading)void refresh();},[refresh,sessionLoading]);

  async function remove(postId:string){
    setRemoving(postId);setError('');
    try{
      await apiFetch('/posts/'+encodeURIComponent(postId)+'/save',{method:'DELETE'});
      setItems(old=>old.filter(item=>item.postId!==postId));
    }catch(cause){
      setError(cause instanceof Error?cause.message:(en?'Could not remove bookmark.':'Impossible de retirer le favori.'));
    }finally{setRemoving(null);}
  }

  return <main className="shell" style={{maxWidth:760,margin:'0 auto',paddingBottom:90}}>
    <header style={{display:'flex',alignItems:'center',gap:12,justifyContent:'space-between',flexWrap:'wrap'}}>
      <div>
        <small style={{color:'var(--muted)'}}>{en?'MY LIBRARY':'MA BIBLIOTHÈQUE'}</small>
        <h1 style={{margin:'6px 0'}}>{en?'Saved posts':'Publications enregistrées'}</h1>
        <p style={{color:'var(--muted)',margin:0}}>{en?'Private bookmarks synced to your account.':'Favoris privés synchronisés avec ton compte.'}</p>
      </div>
      <div style={{display:'flex',gap:8}}>
        <Link className="btn" href="/profile">{en?'Profile':'Profil'}</Link>
        <button className="btn" onClick={()=>void refresh()} disabled={busy||sessionLoading}>{en?'Refresh':'Actualiser'}</button>
      </div>
    </header>
    {error&&<p role="alert" style={{color:'var(--orange)'}}>{error}</p>}
    {(sessionLoading||busy)&&<p role="status">{en?'Loading…':'Chargement…'}</p>}
    {loaded&&!items.length&&!busy&&<p style={{padding:'24px 0',color:'var(--muted)'}}>
      {en?'No saved posts yet. Use Save underneath a post to find it here.':'Aucune publication enregistrée. Appuie sur Enregistrer sous une publication pour la retrouver ici.'}
    </p>}
    {loaded&&items.length>0&&<section aria-label={en?'Saved posts':'Publications enregistrées'} style={{display:'grid',gap:10,marginTop:18}}>
      {items.map(item=><article key={item.postId} className="card" style={{padding:14,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <div style={{display:'grid',gap:4}}>
          <strong>{en?'Saved post':'Publication enregistrée'}</strong>
          <small style={{color:'var(--muted)'}}>{new Date(item.createdAt).toLocaleString(en?'en-US':'fr-FR')}</small>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Link className="btn btn-primary" href={'/feed/'+encodeURIComponent(item.postId)}>{en?'View post':'Voir la publication'}</Link>
          <button className="btn" disabled={removing===item.postId} onClick={()=>void remove(item.postId)}>
            {removing===item.postId?(en?'Removing…':'Retrait…'):(en?'Unsave':'Retirer')}
          </button>
        </div>
      </article>)}
    </section>}
  </main>;
}

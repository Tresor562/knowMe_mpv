'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../../components/i18n-provider';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Channel = {
  id:string;name:string;username:string|null;description:string|null;
  visibility:'PUBLIC'|'PRIVATE';ownerId:string;createdAt:string;
  following:boolean;owner:{username:string;displayName:string;avatarUrl:string|null};
  _count:{subscriptions:number;posts:number};
};
type ChannelPost={id:string;channelId:string;content:string;createdAt:string;author:{displayName:string;username:string}};
type PostPage={items:ChannelPost[];nextCursor:string|null};
export default function ChannelPage(){
  const {id}=useParams<{id:string}>();
  const {user,loading:sessionLoading}=useSession({required:true});
  const {locale}=useI18n();
  const en=locale==='en';
  const tr=(fr:string,english:string)=>en?english:fr;
  const [channel,setChannel]=useState<Channel|null>(null);
  const [posts,setPosts]=useState<ChannelPost[]>([]);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [busy,setBusy]=useState(false);
  const [draft,setDraft]=useState('');
  const [error,setError]=useState('');
  const [editOpen,setEditOpen]=useState(false);
  const [editName,setEditName]=useState('');
  const [editDescription,setEditDescription]=useState('');

  const load=useCallback(async()=>{
    if(!user||!id)return;
    setLoading(true);
    try{
      const [detail,history]=await Promise.all([
        apiFetch<Channel>(`/channels/${encodeURIComponent(id)}`),
        apiFetch<PostPage>(`/channels/${encodeURIComponent(id)}/posts`)
      ]);
      setChannel(detail);setPosts(history.items);setNextCursor(history.nextCursor);
      setEditName(detail.name);setEditDescription(detail.description||'');
      setError('');
    }catch(cause){setError(cause instanceof Error?cause.message:
      tr('Chaîne indisponible.','Channel unavailable.'));}
    finally{setLoading(false);}
  },[id,user?.id,locale]);
  useEffect(()=>{void load();},[load]);

  async function loadMore(){
    if(!nextCursor||loadingMore)return;
    setLoadingMore(true);
    try{
      const page=await apiFetch<PostPage>(`/channels/${encodeURIComponent(id)}/posts?cursor=${encodeURIComponent(nextCursor)}`);
      setPosts(current=>{
        const ids=new Set(current.map(post=>post.id));
        return [...current,...page.items.filter(post=>!ids.has(post.id))];
      });
      setNextCursor(page.nextCursor);setError('');
    }catch(cause){setError(cause instanceof Error?cause.message:tr('Impossible de charger les publications.','Could not load posts.'));}
    finally{setLoadingMore(false);}
  }
  async function toggleFollow(){
    if(!channel||busy||channel.ownerId===user?.id)return;
    setBusy(true);
    try{
      await apiFetch(`/channels/${encodeURIComponent(id)}/follow`,{method:channel.following?'DELETE':'POST'});
      setChannel(current=>current?{...current,following:!current.following,
        _count:{...current._count,subscriptions:Math.max(0,current._count.subscriptions+(current.following?-1:1))}}:null);
      setError('');
    }catch(cause){setError(cause instanceof Error?cause.message:tr('Action impossible.','Action failed.'));}
    finally{setBusy(false);}
  }
  async function publish(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!draft.trim()||busy||!channel||channel.ownerId!==user?.id)return;
    setBusy(true);
    try{
      const created=await apiFetch<ChannelPost>(`/channels/${encodeURIComponent(id)}/posts`,{
        method:'POST',body:JSON.stringify({content:draft.trim()})
      });
      setPosts(current=>[created,...current]);setDraft('');
      setChannel(current=>current?{...current,_count:{...current._count,posts:current._count.posts+1}}:null);
      setError('');
    }catch(cause){setError(cause instanceof Error?cause.message:tr('Publication impossible.','Could not publish.'));}
    finally{setBusy(false);}
  }
  async function saveDetails(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!channel||busy||channel.ownerId!==user?.id)return;
    setBusy(true);
    try{
      const updated=await apiFetch<Channel>(`/channels/${encodeURIComponent(id)}`,{
        method:'PATCH',body:JSON.stringify({name:editName.trim(),description:editDescription.trim()})
      });
      setChannel(current=>current?{...current,...updated}:updated);
      setEditOpen(false);setError('');
    }catch(cause){setError(cause instanceof Error?cause.message:tr('Modification impossible.','Could not update channel.'));}
    finally{setBusy(false);}
  }

  if(sessionLoading||!user)return <main className="shell km-channels-page"><p>{tr('Chargement…','Loading…')}</p></main>;
  const owner=channel?.ownerId===user.id;
  return <main className="shell km-channels-page">
    <header className="km-channels-header">
      <Link href="/channels" className="km-channel-icon-action" aria-label={tr('Retour aux chaînes','Back to channels')}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>
      </Link>
      <h1>{channel?.name||tr('Chaîne','Channel')}</h1>
      <button className="km-channel-icon-action" type="button" onClick={()=>void load()}
        disabled={loading} aria-label={tr('Actualiser','Refresh')}>
        <svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" fill="none" strokeWidth="1.8" aria-hidden="true"><path d="M20 8V3h-5M4 16v5h5"/><path d="M5 9a8 8 0 0 1 14-3l1 2M4 16l1 2a8 8 0 0 0 14-3"/></svg>
      </button>
    </header>
    {error&&<p className="km-auth-error" role="alert">{error}</p>}
    {loading&&<p className="km-channel-empty" role="status">{tr('Chargement de la chaîne…','Loading channel…')}</p>}
    {!loading&&channel&&<>
      <section className="km-channel-profile">
        <div className="km-channel-profile-avatar" aria-hidden="true">{Array.from(channel.name)[0]?.toLocaleUpperCase()||'C'}</div>
        <h2>{channel.name}</h2>
        <p>{channel.username?`@${channel.username}`:
          channel.visibility==='PRIVATE'?tr('Chaîne privée','Private channel'):tr('Chaîne publique','Public channel')}</p>
        {channel.description&&<p className="km-channel-description">{channel.description}</p>}
        <div className="km-channel-stats"><span>{channel._count.subscriptions} {tr('abonnés','subscribers')}</span>
          <span>{channel._count.posts} {tr('publications','posts')}</span></div>
        <div className="km-channel-profile-actions">
          {owner?
            <button type="button" onClick={()=>setEditOpen(value=>!value)}>{tr('Modifier la chaîne','Edit channel')}</button>
            :<button type="button" onClick={()=>void toggleFollow()} disabled={busy}>
              {channel.following?tr('Se désabonner','Unfollow'):tr('S’abonner','Follow')}
            </button>}
          <Link href={`/profile/${encodeURIComponent(channel.owner.username)}`}>{tr('Propriétaire','Owner')}</Link>
        </div>
      </section>
      {editOpen&&owner&&<form className="km-channel-form km-channel-edit" onSubmit={saveDetails}>
        <label htmlFor="channel-edit-name">{tr('Nom','Name')}</label>
        <input id="channel-edit-name" value={editName} onChange={e=>setEditName(e.target.value)}
          required maxLength={72}/>
        <label htmlFor="channel-edit-description">{tr('Description','Description')}</label>
        <textarea id="channel-edit-description" rows={3} maxLength={512}
          value={editDescription} onChange={e=>setEditDescription(e.target.value)}/>
        <button type="submit" className="km-channel-create" disabled={busy||!editName.trim()}>
          {busy?tr('Enregistrement…','Saving…'):tr('Enregistrer','Save')}
        </button>
      </form>}
      {owner&&<form onSubmit={publish} className="km-channel-post-editor">
        <label htmlFor="channel-post-content">{tr('Nouvelle publication','New post')}</label>
        <textarea id="channel-post-content" rows={3} maxLength={4000} value={draft}
          onChange={e=>setDraft(e.target.value)} placeholder={tr('Écrire une publication…','Write a post…')}/>
        <button type="submit" className="km-channel-create" disabled={busy||!draft.trim()}>
          {busy?tr('Envoi…','Publishing…'):tr('Publier','Publish')}
        </button>
      </form>}
      <h2 className="km-channel-post-heading">{tr('Publications','Posts')}</h2>
      <section className="km-channel-posts" aria-label={tr('Liste des publications','Channel posts')}>
        {posts.length===0&&<p className="km-channel-empty">{tr('Aucune publication pour le moment.','No posts yet.')}</p>}
        {posts.map(post=><article className="km-channel-post" key={post.id}>
          <div className="km-channel-post-author">
            <span className="km-channel-avatar is-small" aria-hidden="true">{Array.from(channel.name)[0]?.toLocaleUpperCase()||'C'}</span>
            <span><strong>{channel.name}</strong>
              <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString(locale==='en'?'en-US':'fr-FR',
                {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></span>
          </div>
          <p>{post.content}</p>
        </article>)}
        {nextCursor&&<button type="button" className="km-channel-more" disabled={loadingMore} onClick={()=>void loadMore()}>
          {loadingMore?tr('Chargement…','Loading…'):tr('Publications précédentes','Older posts')}
        </button>}
      </section>
    </>}
  </main>;
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Comment = { id:string; content:string; createdAt:string; author:{id:string;displayName:string;username:string} };
type Post = {
  id:string; content:string; imageUrl?:string|null; createdAt:string; authorId:string;
  author:{id:string;displayName:string;username:string};
  comments:Comment[];
  _count:{likes:number;comments:number};
};

export default function PostDetailPage() {
  const params = useParams<{id:string}>();
  const postId = params.id;
  const {user,loading:sessionLoading} = useSession({required:true});
  const [post,setPost] = useState<Post|null>(null);
  const [message,setMessage] = useState('');
  const [sending,setSending] = useState(false);

  const load = useCallback(async () => {
    try { setPost(await apiFetch<Post>(`/posts/${postId}`)); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Publication introuvable.'); }
  },[postId]);

  useEffect(() => { if (!sessionLoading) load(); },[load,sessionLoading]);

  async function comment(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get('content') ?? '').trim();
    if (!content) return;
    setSending(true);
    try {
      await apiFetch(`/posts/${postId}/comments`,{method:'POST',body:JSON.stringify({content})});
      form.reset();
      await load();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Commentaire impossible.'); }
    finally { setSending(false); }
  }

  async function like() {
    try { await apiFetch(`/posts/${postId}/like`,{method:'POST'}); await load(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Action impossible.'); }
  }

  async function remove() {
    if (!window.confirm('Supprimer définitivement cette publication ?')) return;
    try { await apiFetch(`/posts/${postId}`,{method:'DELETE'}); window.location.href='/feed'; }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.'); }
  }

  if (sessionLoading || !post) return <main className="shell"><p>{message || 'Chargement…'}</p></main>;

  return (
    <main className="shell" style={{maxWidth:760,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><small style={{color:'var(--mint)'}}>DISCUSSION</small><h1>Publication</h1></div><Link href="/feed" className="btn">Retour au fil</Link></header>
      {message && <p style={{color:'var(--orange)'}}>{message}</p>}
      <article className="card" style={{padding:22}}>
        <strong>{post.author.displayName}</strong><div style={{color:'var(--muted)'}}>@{post.author.username}</div>
        <p style={{fontSize:19,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{post.content}</p>
        {post.imageUrl && <img src={post.imageUrl} alt="Média" style={{width:'100%',borderRadius:18}} />}
        <div style={{display:'flex',gap:10,alignItems:'center'}}><button className="btn" onClick={like}>♥ {post._count.likes}</button><span style={{color:'var(--muted)'}}>💬 {post._count.comments}</span>{post.authorId===user?.id && <button className="btn btn-accent" style={{marginLeft:'auto'}} onClick={remove}>Supprimer</button>}</div>
      </article>
      <form className="card" onSubmit={comment} style={{padding:18,display:'flex',gap:10,marginTop:16}}><input className="input" name="content" placeholder="Écris un commentaire…" maxLength={500} required style={{flex:1}} /><button className="btn btn-primary" disabled={sending}>{sending?'Envoi…':'Commenter'}</button></form>
      <section className="grid" style={{marginTop:16}}>
        {post.comments.map(item => <article className="card" key={item.id} style={{padding:16}}><strong>{item.author.displayName}</strong><small style={{color:'var(--muted)',marginLeft:8}}>@{item.author.username}</small><p>{item.content}</p><small style={{color:'var(--muted)'}}>{new Date(item.createdAt).toLocaleString('fr-FR')}</small></article>)}
        {!post.comments.length && <p style={{color:'var(--muted)'}}>Aucun commentaire pour le moment.</p>}
      </section>
    </main>
  );
}

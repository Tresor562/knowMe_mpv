'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Post = {
  id: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  _count: { likes: number; comments: number };
};

export default function FeedPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [publishing, setPublishing] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      setPosts(await apiFetch<Post[]>('/posts/feed'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Fil indisponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const content = String(data.get('content') ?? '').trim();
    if (!content) return;

    setPublishing(true);
    try {
      await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      form.reset();
      await loadFeed();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Publication impossible.');
    } finally {
      setPublishing(false);
    }
  }

  async function toggleLike(postId: string) {
    try {
      const result = await apiFetch<{ liked: boolean }>(`/posts/${postId}/like`, { method: 'POST' });
      setPosts((current) => current.map((post) =>
        post.id === postId
          ? { ...post, _count: { ...post._count, likes: Math.max(0, post._count.likes + (result.liked ? 1 : -1)) } }
          : post
      ));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    }
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement du fil...</p></main>;
  }

  return (
    <main className="shell" style={{maxWidth:760,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--mint)'}}>ACTIVITÉ DE @{user.username}</small>
        <h1>Fil KnowMe</h1>
      </header>

      <form className="card" onSubmit={publish} style={{padding:18,marginBottom:18}}>
        <textarea className="input" name="content" placeholder="Partage une découverte, une question ou un défi..." rows={4} maxLength={1000} required />
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
          <button className="btn btn-primary" disabled={publishing}>
            {publishing ? 'Publication...' : 'Publier'}
          </button>
        </div>
      </form>

      {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}
      {loading && <p>Chargement des publications...</p>}

      <section className="grid">
        {!loading && posts.length === 0 && (
          <article className="card" style={{padding:22,textAlign:'center'}}>
            <h2>Le fil est encore calme</h2>
            <p style={{color:'var(--muted)'}}>Sois la première personne à partager quelque chose.</p>
          </article>
        )}

        {posts.map((post) => (
          <article className="card" key={post.id} style={{padding:20}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:46,height:46,borderRadius:'50%',background:'var(--surface-2)',display:'grid',placeItems:'center',fontWeight:800}}>
                {post.author.displayName[0]}
              </div>
              <div>
                <strong>{post.author.displayName}</strong>
                <div style={{color:'var(--muted)'}}>@{post.author.username}</div>
              </div>
            </div>
            <p style={{fontSize:18,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{post.content}</p>
            {post.imageUrl && <img src={post.imageUrl} alt="Média de la publication" style={{width:'100%',borderRadius:18}} />}
            <div style={{display:'flex',alignItems:'center',gap:12,marginTop:14}}>
              <button className="btn" onClick={() => toggleLike(post.id)}>♥ {post._count.likes}</button>
              <span style={{color:'var(--muted)'}}>💬 {post._count.comments}</span>
              <small style={{color:'var(--muted)',marginLeft:'auto'}}>{new Date(post.createdAt).toLocaleString('fr-FR')}</small>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

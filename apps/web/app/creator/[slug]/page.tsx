'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, getAccessToken } from '../../../lib/api';

type CreatorPost = {
  id: string;
  content: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  createdAt: string;
  _count: { likes: number; comments: number };
};

type CreatorPage = {
  userId: string;
  slug: string;
  title: string;
  bio?: string | null;
  category: string;
  followerCount: number;
  owner: {
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  pinnedPosts: CreatorPost[];
  recentPosts: CreatorPost[];
};

export default function CreatorPublicPage() {
  const params = useParams<{ slug: string }>();
  const slug = useMemo(() => decodeURIComponent(params.slug), [params.slug]);
  const [profile, setProfile] = useState<CreatorPage | null>(null);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void apiFetch<CreatorPage>(`/creators/${encodeURIComponent(slug)}`)
      .then((result) => {
        if (active) setProfile(result);
        if (getAccessToken()) {
          void apiFetch(`/creators/${encodeURIComponent(slug)}/view`, {
            method: 'POST'
          }).catch(() => undefined);
        }
      })
      .catch((cause) => {
        if (active) setMessage(cause instanceof Error ? cause.message : 'Profil introuvable.');
      });
    return () => {
      active = false;
    };
  }, [slug]);

  async function toggleFollow() {
    if (!getAccessToken()) {
      window.location.href = '/';
      return;
    }
    setBusy(true);
    try {
      const next = !following;
      await apiFetch(`/creators/${encodeURIComponent(slug)}/follow`, {
        method: next ? 'PUT' : 'DELETE'
      });
      setFollowing(next);
      setProfile((current) =>
        current
          ? {
              ...current,
              followerCount: Math.max(0, current.followerCount + (next ? 1 : -1))
            }
          : current
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (!profile) {
    return (
      <main className="shell" style={{ maxWidth: 860, margin: '0 auto' }}>
        <p>{message || 'Chargement du profil créateur…'}</p>
      </main>
    );
  }

  const posts = [...profile.pinnedPosts, ...profile.recentPosts];
  return (
    <main className="shell" style={{ maxWidth: 900, margin: '0 auto' }}>
      <header className="card" style={{ padding: 28, marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          {profile.owner.avatarUrl ? (
            <img
              src={profile.owner.avatarUrl}
              alt=""
              width={88}
              height={88}
              style={{ borderRadius: 44, objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: 88, height: 88, borderRadius: 44, display: 'grid', placeItems: 'center', background: 'var(--mint)', color: 'var(--on-primary)', fontSize: 34, fontWeight: 900 }}>
              {profile.owner.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 220 }}>
            <small style={{ color: 'var(--mint)', fontWeight: 800 }}>{profile.category} · CRÉATEUR</small>
            <h1 style={{ marginBottom: 6 }}>{profile.title}</h1>
            <p style={{ color: 'var(--muted)', margin: 0 }}>@{profile.owner.username} · {profile.followerCount} abonné{profile.followerCount === 1 ? '' : 's'}</p>
          </div>
          <button className={following ? 'btn' : 'btn btn-primary'} disabled={busy} onClick={() => void toggleFollow()}>
            {following ? 'Ne plus suivre' : 'Suivre'}
          </button>
        </div>
        {profile.bio ? <p style={{ lineHeight: 1.7, marginTop: 20 }}>{profile.bio}</p> : null}
        {message ? <p role="status" style={{ color: 'var(--orange)' }}>{message}</p> : null}
      </header>

      {profile.pinnedPosts.length ? <h2>Épinglé</h2> : null}
      <section style={{ display: 'grid', gap: 16 }}>
        {posts.map((post, index) => (
          <article className="card" key={post.id} style={{ padding: 22 }}>
            {index < profile.pinnedPosts.length ? <small style={{ color: 'var(--orange)', fontWeight: 800 }}>ÉPINGLÉ</small> : null}
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{post.content}</p>
            {post.imageUrl ? <img src={post.imageUrl} alt="" style={{ width: '100%', maxHeight: 520, objectFit: 'cover', borderRadius: 18 }} /> : null}
            <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
              {post._count.likes} réaction{post._count.likes === 1 ? '' : 's'} · {post._count.comments} commentaire{post._count.comments === 1 ? '' : 's'}
            </p>
          </article>
        ))}
        {!posts.length ? <p style={{ color: 'var(--muted)' }}>Aucune publication pour le moment.</p> : null}
      </section>

      <p style={{ marginTop: 26 }}><Link href="/feed">Retour aux discussions</Link></p>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../components/i18n-provider';
import { apiFetch, getAccessToken } from '../../../lib/api';
import {
  applyCreatorFollowMutation, creatorFollowAction,
  type CreatorFollowMutation, type CreatorFollowSnapshot
} from '../../../lib/creator-follow-state';

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
  const { locale } = useI18n();
  const en = locale === 'en';
  const tr = (fr: string, english: string) => en ? english : fr;
  const [profile, setProfile] = useState<CreatorPage | null>(null);
  const [followState, setFollowState] = useState<CreatorFollowSnapshot | null>(null);
  const [followUnavailable, setFollowUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  const readFollowStatus = useCallback(async () => {
    const state = await apiFetch<CreatorFollowSnapshot>(
      `/creators/${encodeURIComponent(slug)}/follow-status`
    );
    setFollowState(state);
    setFollowUnavailable(false);
    return state;
  }, [slug]);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setFollowState(null);
    setFollowUnavailable(false);
    setMessage('');
    setLoading(true);
    const signedIn = Boolean(getAccessToken());
    setAuthenticated(signedIn);
    void (async () => {
      try {
        const result = await apiFetch<CreatorPage>(`/creators/${encodeURIComponent(slug)}`);
        if (!active) return;
        setProfile(result);
        if (signedIn) {
          try {
            const stored = await apiFetch<CreatorFollowSnapshot>(
              `/creators/${encodeURIComponent(slug)}/follow-status`
            );
            if (active) setFollowState(stored);
          } catch {
            if (active) setFollowUnavailable(true);
          }
          void apiFetch(`/creators/${encodeURIComponent(slug)}/view`, { method: 'POST' })
            .catch(() => undefined);
        }
      } catch (cause) {
        if (active) setMessage(cause instanceof Error
          ? cause.message
          : (en ? 'Creator page unavailable.' : 'Profil créateur introuvable.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug, en]);

  async function refreshFollowStatus() {
    if (busy || !authenticated) return;
    setBusy(true);
    setMessage('');
    try {
      await readFollowStatus();
    } catch {
      setFollowState(null);
      setFollowUnavailable(true);
      setMessage(tr('Impossible de vérifier ton abonnement. Réessaie.',
        'Could not check your subscription. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFollow() {
    const action = creatorFollowAction(authenticated, followState);
    if (busy || (action !== 'follow' && action !== 'unfollow')) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await apiFetch<CreatorFollowMutation>(
        `/creators/${encodeURIComponent(slug)}/follow`,
        { method: action === 'follow' ? 'PUT' : 'DELETE' }
      );
      setFollowState(current => current ? applyCreatorFollowMutation(current, response) : null);
      // Server read resolves concurrent changes and provides the real count.
      try {
        await readFollowStatus();
      } catch {
        // A validated mutation must not be silently replayed on a refresh error.
        setFollowState(null);
        setFollowUnavailable(true);
        setMessage(tr('Abonnement modifié. Actualise son état pour continuer.',
          'Subscription updated. Refresh its status before continuing.'));
      }
    } catch (cause) {
      // Unknown network outcome: a write may have reached the server.
      setFollowState(null);
      setFollowUnavailable(true);
      setMessage(cause instanceof Error ? cause.message :
        tr('Action impossible. Vérifie son état avant de réessayer.',
          'Could not complete the action. Check its status before retrying.'));
    } finally {
      setBusy(false);
    }
  }

  if (!profile) {
    return (
      <main className="shell" style={{ maxWidth: 860, margin: '0 auto' }}>
        <p role={message ? 'alert' : 'status'}>
          {message || tr('Chargement du profil créateur…', 'Loading creator page…')}
        </p>
        {!loading && message ? <Link href="/feed">
          {tr('Retour aux publications', 'Back to posts')}
        </Link> : null}
      </main>
    );
  }

  const viewerAction = creatorFollowAction(authenticated, followState);
  const followerCount = followState?.followerCount ?? profile.followerCount;
  const posts = [...profile.pinnedPosts, ...profile.recentPosts];
  return (
    <main className="shell" style={{ maxWidth: 900, margin: '0 auto' }}>
      <header className="card" style={{ padding: 24, marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          {profile.owner.avatarUrl ? (
            <img src={profile.owner.avatarUrl} alt="" width={84} height={84}
              style={{ borderRadius: 42, objectFit: 'cover' }} />
          ) : (
            <div aria-hidden="true" style={{ width: 84, height: 84, borderRadius: 42,
              display: 'grid', placeItems: 'center', background: 'var(--mint)',
              color: 'var(--on-primary)', fontSize: 34, fontWeight: 900 }}>
              {profile.owner.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 180 }}>
            <small style={{ color: 'var(--mint)', fontWeight: 800 }}>
              {profile.category} · {tr('CRÉATEUR', 'CREATOR')}
            </small>
            <h1 style={{ marginBottom: 6 }}>{profile.title}</h1>
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              <Link href={`/profile/${encodeURIComponent(profile.owner.username)}`}>
                @{profile.owner.username}
              </Link>
              {' · '}{followerCount.toLocaleString(en ? 'en-US' : 'fr-FR')}{' '}
              {tr(followerCount === 1 ? 'abonné' : 'abonnés',
                followerCount === 1 ? 'follower' : 'followers')}
            </p>
          </div>
          {viewerAction === 'login' ? (
            <Link className="btn btn-primary" href="/login">
              {tr('Se connecter pour suivre', 'Sign in to follow')}
            </Link>
          ) : viewerAction === 'owner' ? (
            <Link className="btn" href="/settings/creator">
              {tr('Modifier ma page', 'Edit my page')}
            </Link>
          ) : viewerAction === 'refresh' ? (
            <button className="btn" type="button" disabled={busy}
              aria-label={tr('Vérifier mon abonnement', 'Check subscription')}
              onClick={() => void refreshFollowStatus()}>
              {busy ? tr('Vérification…', 'Checking…')
                : followUnavailable ? tr('Réessayer', 'Retry') : tr('Vérification…', 'Checking…')}
            </button>
          ) : (
            <button className={viewerAction === 'unfollow' ? 'btn' : 'btn btn-primary'}
              type="button" disabled={busy} aria-pressed={viewerAction === 'unfollow'}
              onClick={() => void toggleFollow()}>
              {busy ? tr('Enregistrement…', 'Saving…')
                : viewerAction === 'unfollow'
                  ? tr('Ne plus suivre', 'Unfollow')
                  : tr('Suivre', 'Follow')}
            </button>
          )}
        </div>
        {profile.bio ? <p style={{ lineHeight: 1.7, marginTop: 20 }}>{profile.bio}</p> : null}
        {message ? <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p> : null}
      </header>

      {profile.pinnedPosts.length ? <h2>{tr('Épinglé', 'Pinned')}</h2> : null}
      <section style={{ display: 'grid', gap: 16 }}>
        {posts.map((post, index) => (
          <article className="card" key={post.id} style={{ padding: 22 }}>
            {index < profile.pinnedPosts.length ? (
              <small style={{ color: 'var(--orange)', fontWeight: 800 }}>
                {tr('ÉPINGLÉ', 'PINNED')}
              </small>
            ) : null}
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{post.content}</p>
            {post.imageUrl ? <img src={post.imageUrl} alt=""
              style={{ width: '100%', maxHeight: 520, objectFit: 'cover', borderRadius: 18 }} /> : null}
            <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
              {post._count.likes} {tr(post._count.likes === 1 ? 'réaction' : 'réactions',
                post._count.likes === 1 ? 'reaction' : 'reactions')}
              {' · '}{post._count.comments} {tr(
                post._count.comments === 1 ? 'commentaire' : 'commentaires',
                post._count.comments === 1 ? 'comment' : 'comments'
              )}
            </p>
          </article>
        ))}
        {!posts.length ? (
          <p style={{ color: 'var(--muted)' }}>
            {tr('Aucune publication pour le moment.', 'No posts yet.')}
          </p>
        ) : null}
      </section>
      <p style={{ marginTop: 26 }}>
        <Link href="/feed">{tr('Retour aux publications', 'Back to posts')}</Link>
      </p>
    </main>
  );
}

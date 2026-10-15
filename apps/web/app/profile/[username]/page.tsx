'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { ProfileCover } from '../../../components/profile-cover';
import { useI18n } from '../../../components/i18n-provider';
import { useSession } from '../../../lib/use-session';

type Access = { visible: boolean; reason: string };
type PublicProfile = {
  header: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    joinedYear: number | null;
    coverAssetId: string | null;
    coverVideoAssetId: string | null;
    frameAssetId: string | null;
    themeKey: string;
    effectKey: string | null;
    influencerMode: boolean;
    secretLink: string | null;
  };
  viewer: { relation: string; owner: boolean };
  privacy: {
    profileLocked: boolean;
    lockedForViewer: boolean;
    lockMessage: string | null;
    sections: Record<string, Access>;
    serverResolved: true;
    hiddenDataOmitted: true;
  };
  guard: {
    protected: boolean;
    style?: string;
    warnViewer?: boolean;
    disclosure?: { android: string; ios: string; web: string };
  };
  statistics: Record<string, number | string | boolean | null> | null;
  evolution: { tier: number; unlocks: string[] } | null;
  circles: Array<{
    id: string;
    type: string;
    name: string;
    slug: string;
    accentColor: string;
    level: number;
    xp: number;
    role: string;
  }> | null;
  timeline: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    happenedAt: string;
  }> | null;
  wall: Array<{
    id: string;
    contentType: string;
    text: string | null;
    createdAt: string;
  }> | null;
  gifts: Array<{
    id: string;
    giftInstanceId: string;
    pinned: boolean;
    position: number;
  }> | null;
  compatibility: {
    overallBps: number;
    categories: unknown;
    explanation: unknown;
    privateSignalsExposed: false;
  } | null;
  shareCard: { shortCode: string; url: string; qrPayload: string };
};

type FriendshipRelation = {
  status: 'SELF' | 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS' | 'BLOCKED';
  targetUserId: string;
  friendshipId: string | null;
  legacy?: boolean;
};

type ProfileConversation = { id: string; isGroup: boolean; members: Array<{ userId: string }> };
type SocialSearchUser = { id: string; username: string };
type SocialIncoming = { id: string; requester: { id: string } };
type SocialFriend = { friendshipId: string; user: { id: string } };

// Keep direct add-friend available while the VPS is still running the older API.
async function readFriendship(username: string): Promise<FriendshipRelation> {
  try {
    return await apiFetch<FriendshipRelation>(
      `/social/friendships/by-username/${encodeURIComponent(username)}`
    );
  } catch (cause) {
    if ((cause as { status?: number })?.status !== 404) throw cause;
  }

  const found = await apiFetch<SocialSearchUser[]>(
    `/social/search?q=${encodeURIComponent(username)}`
  );
  const target = found.find(item => item.username.toLowerCase() === username.toLowerCase());
  if (!target) throw new Error('Utilisateur introuvable.');
  const [friends, requests] = await Promise.all([
    apiFetch<SocialFriend[]>('/social/friends'),
    apiFetch<SocialIncoming[]>('/social/friend-requests/incoming')
  ]);
  const friend = friends.find(item => item.user.id === target.id);
  const received = requests.find(item => item.requester.id === target.id);
  return {
    status: friend ? 'FRIENDS' : received ? 'INCOMING' : 'NONE',
    targetUserId: target.id,
    friendshipId: friend?.friendshipId ?? received?.id ?? null,
    legacy: true
  };
}

function title(value: string, en: boolean) {
  const names: Record<string, [string, string]> = {
    totalXp: ['XP total', 'Total XP'], xp: ['XP', 'XP'], level: ['Niveau', 'Level'],
    friends: ['Amis', 'Friends'], gamesWon: ['Jeux gagnés', 'Games won'],
    followers: ['Abonnés', 'Followers'], following: ['Abonnements', 'Following'],
    giftsSent: ['Cadeaux envoyés', 'Gifts sent'], giftsReceived: ['Cadeaux reçus', 'Gifts received'],
    dailyStreak: ['Jours consécutifs', 'Daily streak'], messagesSent: ['Messages envoyés', 'Messages sent'],
    activeMinutes: ['Minutes actives', 'Active minutes'], challengesWon: ['Défis gagnés', 'Challenges won'],
    challengesCreated: ['Défis créés', 'Challenges created'],
    knowCoinsSpent: ['KnowCoins dépensés', 'KnowCoins spent'],
    knowCoinsEarned: ['KnowCoins gagnés', 'KnowCoins earned'],
    quizzesCreated: ['Quiz créés', 'Quizzes created'],
    quizzesCompleted: ['Quiz terminés', 'Quizzes completed'],
    averageAffinityBps: ['Affinité moyenne', 'Average affinity'],
  };
  if (names[value]) return names[value][en ? 1 : 0];
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
    .toLocaleLowerCase(en ? 'en' : 'fr').replace(/^./, letter => letter.toLocaleUpperCase(en ? 'en' : 'fr'));
}

export default function PublicProfilePage() {
  const { locale } = useI18n();
  const en = locale === 'en';
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [notice, setNotice] = useState('');
  const [posting, setPosting] = useState(false);
  const [relationship, setRelationship] = useState<FriendshipRelation | null>(null);
  const [relationshipError, setRelationshipError] = useState('');
  const [relationshipBusy, setRelationshipBusy] = useState(false);
  const [messagingBusy, setMessagingBusy] = useState(false);
  const [authorityFresh, setAuthorityFresh] = useState(false);
  const loadGeneration = useRef(0);

  const invalidateAuthority = useCallback(() => {
    loadGeneration.current += 1;
    setAuthorityFresh(false);
    setProfile(null);
    setRelationship(null);
    setRelationshipError('');
  }, []);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setAuthorityFresh(false);
    setProfile(null);
    setRelationship(null);
    setRelationshipError('');
    setNotice('');

    try {
      const username = decodeURIComponent(params.username);
      const incoming = await apiFetch<PublicProfile>(
        `/profile-experience/public/${encodeURIComponent(username)}`
      );
      if (generation !== loadGeneration.current) return;
      if (user && !incoming.viewer.owner) {
        try {
          const social = await readFriendship(incoming.header.username);
          if (generation !== loadGeneration.current) return;
          setRelationship(social);
        } catch {
          if (generation !== loadGeneration.current) return;
          setRelationshipError(en
            ? 'Friendship actions are temporarily unavailable.'
            : 'Les actions d’amitié sont temporairement indisponibles.');
        }
      }
      setProfile(incoming);
      setAuthorityFresh(true);
    } catch (cause) {
      if (generation !== loadGeneration.current) return;
      setProfile(null);
      setAuthorityFresh(false);
      setNotice(cause instanceof Error ? cause.message : 'Profil indisponible.');
    }
  }, [params.username, user?.id, en]);

  useEffect(() => {
    invalidateAuthority();
    if (!sessionLoading) void load();
    return () => {
      loadGeneration.current += 1;
    };
  }, [invalidateAuthority, load, sessionLoading, user?.id]);

  async function postToWall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !user || !authorityFresh || posting) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const text = String(form.get('text') ?? '').trim();
    if (!text) return;
    setPosting(true);
    try {
      await apiFetch(
        `/profile-experience/public/${encodeURIComponent(profile.header.username)}/wall`,
        {
          method: 'POST',
          body: JSON.stringify({ contentType: 'TEXT', text })
        }
      );
      formElement.reset();
      await load();
      setNotice(profile.viewer.owner
        ? (en ? 'Posted to your wall.' : 'Publication ajoutée au mur.')
        : (en ? 'Post sent for approval.' : 'Publication envoyée pour validation.'));
    } catch (cause) {
      invalidateAuthority();
      setNotice(cause instanceof Error ? cause.message : 'Publication impossible.');
    } finally {
      setPosting(false);
    }
  }

  async function actOnFriendship(action: 'send' | 'cancel' | 'accept' | 'decline' | 'remove') {
    if (!user || !profile || !relationship || !authorityFresh || relationshipBusy) return;
    const current = relationship;
    setRelationshipBusy(true);
    setNotice('');
    try {
      if (action === 'send' && current.status === 'NONE') {
        const sent = await apiFetch<{ id: string }>('/social/friend-requests', {
          method: 'POST', body: JSON.stringify({ addresseeId: current.targetUserId })
        });
        if (current.legacy) {
          setRelationship({ ...current, status: 'OUTGOING', friendshipId: sent.id });
          setNotice(en ? 'Friend request sent.' : 'Demande d’amitié envoyée.');
          return;
        }
      } else if (action === 'cancel' && current.status === 'OUTGOING' && current.friendshipId) {
        await apiFetch(`/social/friend-requests/${encodeURIComponent(current.friendshipId)}`, { method: 'DELETE' });
      } else if ((action === 'accept' || action === 'decline') && current.status === 'INCOMING' && current.friendshipId) {
        await apiFetch(`/social/friend-requests/${encodeURIComponent(current.friendshipId)}/${action}`, { method: 'PATCH' });
      } else if (action === 'remove' && current.status === 'FRIENDS' && current.friendshipId) {
        await apiFetch(`/social/friends/${encodeURIComponent(current.friendshipId)}`, { method: 'DELETE' });
      } else {
        return;
      }
      const next = await readFriendship(profile.header.username);
      setRelationship(next);
      setNotice(({
        send: en ? 'Friend request sent.' : 'Demande d’amitié envoyée.',
        cancel: en ? 'Request cancelled.' : 'Demande annulée.',
        accept: en ? 'Friend request accepted.' : 'Demande acceptée.',
        decline: en ? 'Request declined.' : 'Demande refusée.',
        remove: en ? 'Friend removed.' : 'Ami retiré.'
      })[action]);
    } catch (cause) {
      // The request may have succeeded while the refresh failed: never display stale controls.
      setRelationship(null);
      setRelationshipError(en
        ? 'Refresh the profile to see the current friendship status.'
        : 'Actualise le profil pour connaître l’état actuel de cette relation.');
      setNotice(cause instanceof Error ? cause.message : (en ? 'Action unavailable.' : 'Action impossible.'));
    } finally {
      setRelationshipBusy(false);
    }
  }

  async function openPrivateConversation() {
    if (!user || !profile || !relationship || profile.viewer.owner ||
        relationship.status === 'BLOCKED' || messagingBusy) return;
    setMessagingBusy(true);
    setNotice('');
    try {
      const targetId = relationship.targetUserId;
      const conversations = await apiFetch<ProfileConversation[]>('/conversations');
      const existing = conversations.find(chat =>
        !chat.isGroup && chat.members.length === 2 &&
        chat.members.some(member => member.userId === user.id) &&
        chat.members.some(member => member.userId === targetId)
      );
      const id = existing?.id ?? (await apiFetch<{ id: string }>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ memberIds: [targetId] })
      })).id;
      router.push(`/messages/${encodeURIComponent(id)}`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message :
        (en ? 'Unable to open the conversation.' : 'Impossible d’ouvrir la conversation.'));
    } finally {
      setMessagingBusy(false);
    }
  }

  async function shareProfile() {
    if (!profile || !authorityFresh) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Profil KnowMe de ${profile.header.displayName}`,
          url: profile.shareCard.url
        });
      } else {
        await navigator.clipboard.writeText(profile.shareCard.url);
        setNotice('Lien du profil copié.');
      }
    } catch {
      setNotice('Partage annulé.');
    }
  }

  if (sessionLoading || !authorityFresh || !profile) {
    return (
      <main className="shell km-public-profile">
        <p role={notice ? 'alert' : 'status'}>{notice || (en ? 'Loading profile…' : 'Chargement du profil…')}</p>
        {notice && <div className="km-public-actions">
          <button type="button" onClick={() => void load()}>{en ? 'Try again' : 'Réessayer'}</button>
          <Link href="/discover">{en ? 'Discover people' : 'Découvrir des personnes'}</Link>
        </div>}
      </main>
    );
  }

  const initials = profile.header.displayName[0]?.toLocaleUpperCase('fr') ?? '?';
  const stats = Object.entries(profile.statistics ?? {}).filter(([, value]) => value != null);
  const priority = ['xp', 'totalXp', 'level', 'friends', 'followers', 'following'];
  const rankedStats = [...stats].sort(([a], [b]) => {
    const rank = (key: string) => priority.includes(key) ? priority.indexOf(key) : priority.length;
    return rank(a) - rank(b);
  });
  const highlightedStats = rankedStats.slice(0, 4);
  const additionalStats = rankedStats.slice(4);

  return (
    <main className="shell km-public-profile" data-profile-guard={profile.guard.protected ? 'protected' : 'off'}>
      <section className="km-public-hero" aria-label={en?'Public profile':'Profil public'}>
        <ProfileCover assetId={profile.header.coverAssetId} />
        <div className="km-public-identity">
          <div className="km-public-avatar">
            {profile.header.avatarUrl
              ? <img src={profile.header.avatarUrl} alt={profile.header.displayName}/>
              : <span>{initials}</span>}
          </div>
          <div className="km-public-name">
            <h1>{profile.privacy.profileLocked && <span aria-label={en?'Locked':'Verrouillé'}>♢ </span>}{profile.header.displayName}</h1>
            <p>@{profile.header.username}{profile.header.joinedYear ? ` · ${en?'Since':'Depuis'} ${profile.header.joinedYear}` : ''}</p>
            {profile.header.bio&&<p className="km-public-bio">{profile.header.bio}</p>}
          </div>
          <div className="km-public-actions">
            {!profile.viewer.owner && user && relationship?.status !== 'BLOCKED' && (
              <button type="button" className="km-public-primary"
                disabled={!relationship || messagingBusy} onClick={() => void openPrivateConversation()}>
                {messagingBusy ? (en ? 'Opening…' : 'Ouverture…') : (en ? 'Message' : 'Message')}
              </button>
            )}
            {profile.viewer.owner && <Link className="km-public-primary" href="/profile?edit=1#edit">{en?'Edit profile':'Modifier le profil'}</Link>}
            {!profile.viewer.owner && !user && <Link className="km-public-primary" href="/login">{en?'Sign in to add':'Se connecter pour ajouter'}</Link>}
            {!profile.viewer.owner && relationship?.status === 'NONE' && (
              <button type="button" disabled={relationshipBusy} onClick={() => void actOnFriendship('send')}>
                {en ? '+ Add friend' : '+ Ajouter en ami'}
              </button>
            )}
            {!profile.viewer.owner && relationship?.status === 'OUTGOING' && (
              relationship.legacy
                ? <span role="status">{en ? 'Request sent' : 'Demande envoyée'}</span>
                : <button type="button" disabled={relationshipBusy} onClick={() => void actOnFriendship('cancel')}>
                    {en ? 'Request sent · Cancel' : 'Demande envoyée · Annuler'}
                  </button>
            )}
            {!profile.viewer.owner && relationship?.status === 'INCOMING' && (
              <>
                <button type="button" disabled={relationshipBusy} onClick={() => void actOnFriendship('accept')}>
                  {en ? 'Accept request' : 'Accepter la demande'}
                </button>
                <button type="button" disabled={relationshipBusy} onClick={() => void actOnFriendship('decline')}>
                  {en ? 'Decline' : 'Refuser'}
                </button>
              </>
            )}
            {!profile.viewer.owner && relationship?.status === 'FRIENDS' && (
              <>
                <span role="status" aria-label={en ? 'Friends' : 'Amis'}>✓ {en ? 'Friends' : 'Amis'}</span>
                <button type="button" disabled={relationshipBusy} onClick={() => void actOnFriendship('remove')}>
                  {en ? 'Remove friend' : 'Retirer des amis'}
                </button>
              </>
            )}
            {!profile.viewer.owner && relationship?.status === 'BLOCKED' && (
              <span role="status">{en ? 'Friendship unavailable' : 'Relation indisponible'}</span>
            )}
            {!profile.viewer.owner && user && relationshipError && (
              <span role="status" style={{color:'var(--muted)',fontSize:13}}>{relationshipError}</span>
            )}
            <button type="button" className={profile.viewer.owner ? '' : undefined} onClick={shareProfile}>
              {en?'Share':'Partager'}
            </button>
            {profile.wall && <a href="#km-profile-wall">{en?'Posts':'Publications'}</a>}
            {!profile.viewer.owner && profile.header.secretLink && (
              <Link href={profile.header.secretLink}>{en?'Anonymous message':'Message anonyme'}</Link>
            )}
            {profile.viewer.owner && <Link href="/profile-studio">{en?'Customize':'Personnaliser'}</Link>}
          </div>
        </div>

      </section>

      {notice && <section className="card" style={{ padding: 14 }} role="status">{notice}</section>}

      {profile.privacy.lockedForViewer && (
        <section className="card" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 46 }}>🔒</div>
          <h2>Profil verrouillé</h2>
          <p style={{ color: 'var(--muted)' }}>{profile.privacy.lockMessage}</p>
          <Link className="btn btn-primary" href="/friends">{en?"Find friends":"Trouver des amis"}</Link>
        </section>
      )}

      {profile.evolution && (
        <section className="km-public-level" aria-label={en?'Profile level':'Niveau du profil'}>
          <span>{en?'Visual level':'Niveau visuel'} <strong>{profile.evolution.tier}/5</strong></span>
          {profile.evolution.unlocks.length > 0 && (
            <small>{profile.evolution.unlocks.map(unlock => title(unlock, en)).join(' · ')}</small>
          )}
        </section>
      )}

      {rankedStats.length > 0 && (
        <section className="km-public-stats" aria-label={en?'Profile statistics':'Statistiques du profil'}>
          <h2>{en?'At a glance':'En bref'}</h2>
          <div className="km-public-stats-grid">
            {highlightedStats.map(([key, value]) => (
              <div className="km-public-stat" key={key}>
                <strong>{String(value)}</strong><span>{title(key, en)}</span>
              </div>
            ))}
          </div>
          {additionalStats.length > 0 && (
            <details className="km-public-more-stats">
              <summary>{en?'More statistics':'Voir les autres statistiques'}</summary>
              <div className="km-public-stats-grid">
                {additionalStats.map(([key, value]) => (
                  <div className="km-public-stat" key={key}>
                    <strong>{String(value)}</strong><span>{title(key, en)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {profile.compatibility && (
        <section className="card" style={{ padding: 24 }}>
          <small style={{ color: 'var(--mint)' }}>{en?'AFFINITY':'AFFINITÉ'}</small>
          <h2>{Math.round(profile.compatibility.overallBps / 100)} % d’affinité</h2>

        </section>
      )}

      {profile.circles && profile.circles.length > 0 && (
        <section>
          <h2>Duos, équipes, familles et guildes</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
            {profile.circles.map((circle) => (
              <article className="card" style={{ padding: 20, borderColor: circle.accentColor }} key={circle.id}>
                <small>{circle.type}</small>
                <h3>{circle.name}</h3>
                <p style={{ color: 'var(--muted)' }}>Niveau {circle.level} · {circle.xp} XP · {circle.role}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {profile.timeline && (
        <section className="card" style={{ padding: 24 }}>
          <h2>Souvenirs KnowMe</h2>
          {profile.timeline.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Aucun souvenir partagé avec cette audience.</p>
          ) : (
            profile.timeline.map((event) => (
              <article key={event.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                <small style={{ color: 'var(--mint)' }}>{event.type} · {new Date(event.happenedAt).toLocaleDateString('fr-FR')}</small>
                <h3>{event.title}</h3>
                {event.description && <p style={{ color: 'var(--muted)' }}>{event.description}</p>}
              </article>
            ))
          )}
        </section>
      )}

      {profile.gifts && (
        <section className="card" style={{ padding: 24 }}>
          <h2>🎁 Galerie des cadeaux</h2>
          {profile.gifts.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Aucun cadeau exposé.</p>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
              {profile.gifts.map((gift) => (
                <article className="card" style={{ padding: 16, textAlign: 'center' }} key={gift.id}>
                  <div style={{ fontSize: 38 }}>{gift.pinned ? '💎' : '🎁'}</div>
                  <small>{gift.giftInstanceId}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {profile.wall && (
        <section className="km-public-wall" id="km-profile-wall">
          <h2>{en?'Profile wall':'Mur du profil'}</h2>
          {user ? (
            <form className="km-public-wall-form" onSubmit={postToWall}>
              <label className="km-public-wall-input">
                <span className="km-visually-hidden-file">{en?'Message':'Message'}</span>
                <textarea name="text" rows={2} maxLength={1000}
                  placeholder={en?'Leave a message…':'Laisse un message…'}
                  required disabled={posting || !authorityFresh} />
              </label>
              <button className="km-public-wall-submit" type="submit" disabled={posting || !authorityFresh}>
                {posting ? (en?'Sending…':'Envoi…') : (en?'Publish':'Publier')}
              </button>
            </form>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Connecte-toi pour participer au mur selon les règles du propriétaire.</p>
          )}
          {profile.wall.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Le mur attend son premier souvenir.</p>
          ) : (
            profile.wall.map((post) => (
              <article className="km-public-wall-entry" key={post.id}>
                <small>{post.contentType} · {new Date(post.createdAt).toLocaleDateString('fr-FR')}</small>
                {post.text && <p>{post.text}</p>}
              </article>
            ))
          )}
        </section>
      )}


    </main>
  );
}

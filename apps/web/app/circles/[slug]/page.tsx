'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type CircleSnapshot = {
  circle: {
    id: string;
    type: string;
    name: string;
    slug: string;
    status: string;
    bannerAssetId: string | null;
    emblemAssetId: string | null;
    accentColor: string;
    sharedBio: string | null;
    animationKey: string | null;
    visibility: string;
    joinable: boolean;
    createdAt: string;
  };
  progression: {
    level: number;
    xp: number;
    nextLevelXp: number | null;
    remainingXp: number;
    maximumLevel: number;
  };
  members: Array<{
    role: string;
    bioFragment: string | null;
    portraitPosition: number | null;
    joinedAt: string | null;
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    xpAwarded: number;
    occurredAt: string;
  }>;
  viewer: {
    member: boolean;
    role: string | null;
    accessReason: string;
    canRequestJoin: boolean;
    canManage: boolean;
  };
  privacy: {
    inactiveMembersOmitted: boolean;
    pendingInvitationsOmitted: boolean;
    joinRequestsOmitted: boolean;
    memberPrivateDataOmitted: boolean;
    serverResolved: boolean;
  };
};

const TYPE_LABELS: Record<string, string> = {
  DUO_COUPLE: 'Duo Couple',
  DUO_BEST_FRIENDS: 'Duo Meilleurs amis',
  DUO_SIBLINGS: 'Duo Frère / sœur',
  DUO_GAMING: 'Duo Gaming',
  DUO_CREATIVE: 'Duo Créatif',
  TEAM: 'Équipe',
  FAMILY: 'Famille',
  GUILD: 'Guilde'
};

const ACTIVITY_LABELS: Record<string, string> = {
  CHALLENGE_WON: 'Défi remporté',
  GAME_WON: 'Partie remportée',
  MOMENT_PUBLISHED: 'Moment publié',
  STORY_PUBLISHED: 'Story publiée',
  EVENT_COMPLETED: 'Événement terminé',
  GIFT_RECEIVED: 'Cadeau reçu',
  MEMBER_CONTRIBUTION: 'Contribution collective'
};

export default function PublicCirclePage() {
  const params = useParams<{ slug: string }>();
  const { user, loading: sessionLoading } = useSession();
  const [snapshot, setSnapshot] = useState<CircleSnapshot | null>(null);
  const [message, setMessage] = useState('');
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    try {
      const slug = decodeURIComponent(params.slug);
      setSnapshot(
        await apiFetch<CircleSnapshot>(
          `/profile-circles/public/${encodeURIComponent(slug)}`
        )
      );
      setMessage('');
    } catch (cause) {
      setSnapshot(null);
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Ce profil collectif est indisponible.'
      );
    }
  }, [params.slug]);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function requestJoin() {
    if (!snapshot) return;
    setJoining(true);
    try {
      await apiFetch(`/profile-circles/${snapshot.circle.id}/join-requests`, {
        method: 'POST',
        body: JSON.stringify({
          message: `Je souhaite rejoindre ${snapshot.circle.name}.`
        })
      });
      setMessage('Demande d’adhésion envoyée aux responsables de la guilde.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Demande impossible.');
    } finally {
      setJoining(false);
    }
  }

  if (sessionLoading || (!snapshot && !message)) {
    return <main className="shell"><p>Chargement du profil collectif…</p></main>;
  }

  if (!snapshot) {
    return (
      <main className="shell" style={{ maxWidth: 760, margin: '0 auto' }}>
        <section className="card" style={{ padding: 28 }}>
          <h1>Profil collectif indisponible</h1>
          <p style={{ color: 'var(--muted)' }}>{message}</p>
          <Link className="btn" href="/profile">Retour au profil</Link>
        </section>
      </main>
    );
  }

  const progressPercent = snapshot.progression.nextLevelXp
    ? Math.min(
        100,
        Math.round(
          (snapshot.progression.xp / snapshot.progression.nextLevelXp) * 100
        )
      )
    : 100;

  return (
    <main
      className="shell"
      style={{ maxWidth: 1040, margin: '0 auto', display: 'grid', gap: 20 }}
    >
      <section
        className="card"
        style={{
          overflow: 'hidden',
          borderColor: snapshot.circle.accentColor
        }}
      >
        <div
          style={{
            minHeight: 190,
            padding: 28,
            background: `linear-gradient(135deg, ${snapshot.circle.accentColor}44, var(--surface-2))`,
            display: 'flex',
            alignItems: 'flex-end'
          }}
        >
          <div style={{ flex: 1 }}>
            <small>{TYPE_LABELS[snapshot.circle.type] ?? snapshot.circle.type}</small>
            <h1 style={{ marginBottom: 6 }}>{snapshot.circle.name}</h1>
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              {snapshot.circle.sharedBio ??
                'Une identité collective construite par ses membres.'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: 34 }}>
              Niveau {snapshot.progression.level}
            </strong>
            <div>{snapshot.progression.xp.toLocaleString('fr-FR')} XP</div>
          </div>
        </div>
        <div style={{ padding: 22 }}>
          <div
            aria-label={`Progression ${progressPercent}%`}
            style={{
              height: 10,
              borderRadius: 999,
              background: 'var(--surface-2)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: snapshot.circle.accentColor
              }}
            />
          </div>
          <p style={{ color: 'var(--muted)' }}>
            {snapshot.progression.nextLevelXp
              ? `${snapshot.progression.remainingXp.toLocaleString('fr-FR')} XP avant le niveau suivant.`
              : 'Niveau collectif maximal atteint.'}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {snapshot.viewer.canRequestJoin && user && (
              <button
                className="btn btn-primary"
                disabled={joining}
                onClick={() => void requestJoin()}
              >
                {joining ? 'Envoi…' : 'Demander à rejoindre'}
              </button>
            )}
            {snapshot.viewer.canRequestJoin && !user && (
              <Link className="btn btn-primary" href="/login">
                Se connecter pour rejoindre
              </Link>
            )}
            {snapshot.viewer.canManage && (
              <Link className="btn" href="/profile-circles">
                Gérer cette structure
              </Link>
            )}
            <Link className="btn" href="/profile">Mon profil</Link>
          </div>
          {message && <p role="status" style={{ color: 'var(--mint)' }}>{message}</p>}
        </div>
      </section>

      <section className="card" style={{ padding: 24 }}>
        <h2>Membres actifs · {snapshot.members.length}</h2>
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}
        >
          {snapshot.members.map((member) => (
            <Link
              href={`/profile/${encodeURIComponent(member.user.username)}`}
              key={member.user.id}
              className="card"
              style={{ padding: 18, textDecoration: 'none' }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: `linear-gradient(135deg, ${snapshot.circle.accentColor}, var(--surface-2))`,
                    fontWeight: 900
                  }}
                >
                  {member.user.displayName[0]?.toUpperCase()}
                </div>
                <div>
                  <strong>{member.user.displayName}</strong>
                  <div style={{ color: 'var(--muted)' }}>@{member.user.username}</div>
                  <small>{member.role}</small>
                </div>
              </div>
              {member.bioFragment && <p>{member.bioFragment}</p>}
            </Link>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 24 }}>
        <h2>Activité collective récente</h2>
        {snapshot.recentActivity.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>
            Aucune activité collective publiée pour le moment.
          </p>
        )}
        <div className="grid">
          {snapshot.recentActivity.map((activity) => (
            <article className="card" style={{ padding: 16 }} key={activity.id}>
              <strong>{ACTIVITY_LABELS[activity.type] ?? activity.type}</strong>
              <div style={{ color: 'var(--mint)' }}>+{activity.xpAwarded} XP</div>
              <small style={{ color: 'var(--muted)' }}>
                {new Date(activity.occurredAt).toLocaleString('fr-FR')}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <small style={{ color: 'var(--muted)' }}>
          Les invitations, membres inactifs, demandes d’adhésion et données privées
          ne sont jamais inclus dans cette vue publique. La progression collective
          est gagnée par l’activité et ne peut pas être achetée.
        </small>
      </section>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type CircleEntry = {
  membership: {
    id: string;
    role: string;
    status: string;
    joinedAt: string | null;
    consentedAt: string | null;
  };
  circle: {
    id: string;
    type: string;
    name: string;
    slug: string;
    ownerUserId: string;
    status: string;
    accentColor: string;
    visibility: string;
    joinable: boolean;
    xp: number;
    level: number;
    _count: {
      members: number;
      joinRequests: number;
      activities: number;
    };
    progression: {
      level: number;
      xp: number;
      nextLevelXp: number | null;
      remainingXp: number;
    };
  };
  capabilities: {
    accept: boolean;
    decline: boolean;
    leave: boolean;
    manage: boolean;
  };
};

type JoinRequest = {
  id: string;
  circleId: string;
  userId: string;
  message: string | null;
  status: string;
  createdAt: string;
  applicant: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

const TYPE_LABELS: Record<string, string> = {
  DUO_COUPLE: '❤️ Couple',
  DUO_BEST_FRIENDS: '💙 Meilleurs amis',
  DUO_SIBLINGS: '💜 Frère / sœur',
  DUO_GAMING: '🩷 Duo gaming',
  DUO_CREATIVE: '💛 Duo créatif',
  TEAM: '⭐ Équipe',
  FAMILY: '👨‍👩‍👧‍👦 Famille',
  GUILD: '🎮 Guilde'
};

export default function ProfileCirclesPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [entries, setEntries] = useState<CircleEntry[]>([]);
  const [requests, setRequests] = useState<Record<string, JoinRequest[]>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setEntries(await apiFetch<CircleEntry[]>('/profile-circles/me'));
      setMessage('');
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Chargement des profils collectifs impossible.'
      );
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user]);

  async function action(key: string, path: string, body?: unknown) {
    setBusy(key);
    try {
      await apiFetch(path, {
        method: 'POST',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
      setMessage('Action collective enregistrée.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy('');
    }
  }

  async function loadRequests(circleId: string) {
    setBusy(`requests:${circleId}`);
    try {
      const value = await apiFetch<JoinRequest[]>(
        `/profile-circles/${circleId}/join-requests`
      );
      setRequests((current) => ({ ...current, [circleId]: value }));
      setMessage(
        value.length
          ? `${value.length} demande(s) d’adhésion en attente.`
          : 'Aucune demande en attente.'
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Lecture impossible.');
    } finally {
      setBusy('');
    }
  }

  async function review(
    circleId: string,
    requestId: string,
    decision: 'APPROVE' | 'DECLINE'
  ) {
    setBusy(`review:${requestId}`);
    try {
      await apiFetch(
        `/profile-circles/${circleId}/join-requests/${requestId}/review`,
        {
          method: 'POST',
          body: JSON.stringify({ action: decision })
        }
      );
      await Promise.all([load(), loadRequests(circleId)]);
      setMessage(
        decision === 'APPROVE'
          ? 'Le membre a rejoint la guilde.'
          : 'La demande a été refusée.'
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Décision impossible.');
    } finally {
      setBusy('');
    }
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement des relations…</p></main>;
  }

  return (
    <main
      className="shell"
      style={{ maxWidth: 1040, margin: '0 auto', display: 'grid', gap: 20 }}
    >
      <section className="card" style={{ padding: 28 }}>
        <small style={{ color: 'var(--mint)' }}>CONCEPT K · RELATIONS</small>
        <h1>Duos, Équipes, Familles et Guildes</h1>
        <p style={{ color: 'var(--muted)' }}>
          Accepte ou refuse les invitations, gère les structures dont tu es
          responsable et suis la progression collective gagnée par l’activité réelle.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href="/profile-studio">
            Créer depuis le Studio
          </Link>
          <Link className="btn" href="/profile">Retour au profil</Link>
        </div>
        {message && <p role="status" style={{ color: 'var(--mint)' }}>{message}</p>}
      </section>

      {entries.length === 0 && (
        <section className="card" style={{ padding: 24 }}>
          <h2>Aucune relation collective</h2>
          <p style={{ color: 'var(--muted)' }}>
            Les invitations et structures créées apparaîtront ici.
          </p>
        </section>
      )}

      {entries.map((entry) => {
        const circle = entry.circle;
        const circleRequests = requests[circle.id] ?? [];
        const isBusy = busy.includes(circle.id);
        return (
          <section
            className="card"
            style={{ padding: 24, borderColor: circle.accentColor }}
            key={circle.id}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 18,
                flexWrap: 'wrap'
              }}
            >
              <div>
                <small>{TYPE_LABELS[circle.type] ?? circle.type}</small>
                <h2 style={{ marginBottom: 4 }}>{circle.name}</h2>
                <p style={{ color: 'var(--muted)' }}>
                  {entry.membership.status} · {entry.membership.role} · {circle.status}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: 28 }}>Niveau {circle.progression.level}</strong>
                <div>{circle.progression.xp.toLocaleString('fr-FR')} XP</div>
                <small>{circle._count.members} membre(s)</small>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn" href={`/circles/${encodeURIComponent(circle.slug)}`}>
                Voir la page collective
              </Link>
              {entry.capabilities.accept && (
                <button
                  className="btn btn-primary"
                  disabled={busy === `accept:${circle.id}`}
                  onClick={() =>
                    void action(
                      `accept:${circle.id}`,
                      `/profile-experience/circles/${circle.id}/accept`
                    )
                  }
                >
                  Accepter
                </button>
              )}
              {entry.capabilities.decline && (
                <button
                  className="btn"
                  disabled={busy === `decline:${circle.id}`}
                  onClick={() =>
                    void action(
                      `decline:${circle.id}`,
                      `/profile-circles/${circle.id}/decline`
                    )
                  }
                >
                  Refuser
                </button>
              )}
              {entry.capabilities.leave && (
                <button
                  className="btn"
                  disabled={busy === `leave:${circle.id}`}
                  onClick={() =>
                    void action(
                      `leave:${circle.id}`,
                      `/profile-circles/${circle.id}/leave`
                    )
                  }
                >
                  Quitter
                </button>
              )}
              {entry.capabilities.manage && circle.status === 'ACTIVE' && (
                <button
                  className="btn"
                  disabled={isBusy}
                  onClick={() =>
                    void action(
                      `pause:${circle.id}`,
                      `/profile-circles/${circle.id}/lifecycle`,
                      { action: 'PAUSE' }
                    )
                  }
                >
                  Mettre en pause
                </button>
              )}
              {entry.capabilities.manage && circle.status === 'PAUSED' && (
                <button
                  className="btn btn-primary"
                  disabled={isBusy}
                  onClick={() =>
                    void action(
                      `resume:${circle.id}`,
                      `/profile-circles/${circle.id}/lifecycle`,
                      { action: 'RESUME' }
                    )
                  }
                >
                  Reprendre
                </button>
              )}
              {entry.capabilities.manage && circle.status !== 'ENDED' && (
                <button
                  className="btn"
                  disabled={isBusy}
                  onClick={() =>
                    void action(
                      `end:${circle.id}`,
                      `/profile-circles/${circle.id}/lifecycle`,
                      { action: 'END' }
                    )
                  }
                >
                  Terminer
                </button>
              )}
              {entry.capabilities.manage && circle.type === 'GUILD' && (
                <button
                  className="btn"
                  disabled={busy === `requests:${circle.id}`}
                  onClick={() => void loadRequests(circle.id)}
                >
                  Demandes d’adhésion
                </button>
              )}
            </div>

            {circleRequests.length > 0 && (
              <div className="grid" style={{ marginTop: 18 }}>
                {circleRequests.map((request) => (
                  <article className="card" style={{ padding: 16 }} key={request.id}>
                    <strong>
                      {request.applicant?.displayName ?? 'Compte indisponible'}
                    </strong>
                    {request.applicant && (
                      <div style={{ color: 'var(--muted)' }}>
                        @{request.applicant.username}
                      </div>
                    )}
                    {request.message && <p>{request.message}</p>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary"
                        disabled={busy === `review:${request.id}`}
                        onClick={() => void review(circle.id, request.id, 'APPROVE')}
                      >
                        Accepter
                      </button>
                      <button
                        className="btn"
                        disabled={busy === `review:${request.id}`}
                        onClick={() => void review(circle.id, request.id, 'DECLINE')}
                      >
                        Refuser
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="card" style={{ padding: 20 }}>
        <strong>Garanties</strong>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Une relation n’est affichée qu’après consentement. Les invitations,
          demandes, anciens membres et informations privées ne sont jamais exposés
          sur la page publique. Premium ne peut pas acheter un niveau collectif.
        </p>
      </section>
    </main>
  );
}

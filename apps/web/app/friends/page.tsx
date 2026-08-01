'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AccountBadges, AccountBadgeSet } from '../../components/AccountBadges';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type UserResult = AccountBadgeSet & {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
};

type FriendRequest = {
  id: string;
  requester: UserResult;
};

type Friend = {
  friendshipId: string;
  user: UserResult;
};

function ProfileSummary({ user }: { user: UserResult }) {
  return (
    <div>
      <strong>{user.displayName}</strong>
      <AccountBadges
        compact
        staff={user.staff}
        verification={user.verification}
        premium={user.premium}
      />
      <div style={{ color: 'var(--muted)' }}>@{user.username}</div>
      {user.bio && <small>{user.bio}</small>}
    </div>
  );
}

export default function FriendsPage() {
  const { loading: sessionLoading } = useSession({ required: true });
  const [results, setResults] = useState<UserResult[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSocialData = useCallback(async () => {
    try {
      const [incoming, currentFriends] = await Promise.all([
        apiFetch<FriendRequest[]>('/social/friend-requests/incoming'),
        apiFetch<Friend[]>('/social/friends')
      ]);
      setRequests(incoming);
      setFriends(currentFriends);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void loadSocialData();
  }, [loadSocialData, sessionLoading]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = String(form.get('query') ?? '').trim();

    try {
      const data = await apiFetch<UserResult[]>(
        `/social/search?q=${encodeURIComponent(query)}`
      );
      setResults(data);
      setMessage(
        data.length ? `${data.length} profil(s) trouvé(s).` : 'Aucun profil trouvé.'
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Recherche impossible.');
    }
  }

  async function addFriend(addresseeId: string) {
    setBusyId(addresseeId);
    try {
      await apiFetch('/social/friend-requests', {
        method: 'POST',
        body: JSON.stringify({ addresseeId })
      });
      setMessage('Demande envoyée.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Envoi impossible.');
    } finally {
      setBusyId(null);
    }
  }

  async function respond(id: string, action: 'accept' | 'decline') {
    setBusyId(id);
    try {
      await apiFetch(`/social/friend-requests/${id}/${action}`, {
        method: 'PATCH'
      });
      await loadSocialData();
      setMessage(action === 'accept' ? 'Demande acceptée.' : 'Demande refusée.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  }

  async function removeFriend(friendshipId: string) {
    setBusyId(friendshipId);
    try {
      await apiFetch(`/social/friends/${friendshipId}`, { method: 'DELETE' });
      await loadSocialData();
      setMessage('Relation supprimée.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  }

  if (sessionLoading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{ maxWidth: 920, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>CONNEXIONS</small>
        <h1>Amis et découvertes</h1>
        <p style={{ color: 'var(--muted)' }}>
          Les badges Vérifié, Premium et Équipe KnowMe sont fournis séparément par le serveur.
        </p>
      </header>

      <form
        className="card"
        onSubmit={search}
        style={{ padding: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}
      >
        <input
          className="input"
          name="query"
          placeholder="Nom, pseudo ou centre d’intérêt..."
          minLength={2}
          required
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary">Rechercher</button>
      </form>

      {message && <p style={{ color: 'var(--muted)' }}>{message}</p>}

      {requests.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Demandes reçues</h2>
          <div className="grid">
            {requests.map(({ id, requester }) => (
              <article
                className="card"
                key={id}
                style={{
                  padding: 18,
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap'
                }}
              >
                <ProfileSummary user={requester} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    disabled={busyId === id}
                    onClick={() => void respond(id, 'accept')}
                  >
                    Accepter
                  </button>
                  <button
                    className="btn"
                    disabled={busyId === id}
                    onClick={() => void respond(id, 'decline')}
                  >
                    Refuser
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>Mes amis ({friends.length})</h2>
        <div className="grid">
          {friends.map(({ friendshipId, user }) => (
            <article
              className="card"
              key={friendshipId}
              style={{
                padding: 18,
                display: 'grid',
                gridTemplateColumns: '52px 1fr auto',
                gap: 14,
                alignItems: 'center'
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 900
                }}
              >
                {user.displayName[0]}
              </div>
              <ProfileSummary user={user} />
              <button
                className="btn"
                disabled={busyId === friendshipId}
                onClick={() => void removeFriend(friendshipId)}
              >
                Retirer
              </button>
            </article>
          ))}
          {!friends.length && (
            <p style={{ color: 'var(--muted)' }}>Aucun ami pour le moment.</p>
          )}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Résultats</h2>
        <div className="grid">
          {results.map((user) => (
            <article
              className="card"
              key={user.id}
              style={{
                padding: 20,
                display: 'grid',
                gridTemplateColumns: '56px 1fr auto',
                gap: 16,
                alignItems: 'center'
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 900
                }}
              >
                {user.displayName[0]}
              </div>
              <ProfileSummary user={user} />
              <button
                className="btn btn-accent"
                disabled={busyId === user.id}
                onClick={() => void addFriend(user.id)}
              >
                {busyId === user.id ? 'Envoi…' : 'Ajouter'}
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

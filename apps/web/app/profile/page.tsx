'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AccountBadges } from '../../components/AccountBadges';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type InterestItem = {
  id: string;
  interest: { id: string; name: string; slug: string };
};

export default function ProfilePage() {
  const { user, loading, refresh } = useSession({ required: true });
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!user) return;
    apiFetch<InterestItem[]>('/intelligence/interests')
      .then(setInterests)
      .catch(() => setInterests([]));
  }, [user]);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    try {
      await apiFetch('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: String(data.get('displayName') ?? '').trim(),
          bio: String(data.get('bio') ?? '').trim()
        })
      });
      await refresh();
      setEditing(false);
      setMessage('Profil mis à jour.');
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Mise à jour impossible.'
      );
    }
  }

  async function updateInterests(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = String(data.get('interests') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      const updated = await apiFetch<InterestItem[]>('/intelligence/interests', {
        method: 'PUT',
        body: JSON.stringify({ interests: values })
      });
      setInterests(updated);
      setMessage('Centres d’intérêt enregistrés.');
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Enregistrement impossible.'
      );
    }
  }

  if (loading || !user) {
    return (
      <main className="shell">
        <p>Chargement du profil...</p>
      </main>
    );
  }

  return (
    <main className="shell" style={{ maxWidth: 880, margin: '0 auto' }}>
      <section className="card" style={{ padding: 28 }}>
        <div
          style={{
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,var(--mint),var(--orange))',
              display: 'grid',
              placeItems: 'center',
              fontSize: 42,
              fontWeight: 900
            }}
          >
            {user.displayName[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <small style={{ color: 'var(--mint)' }}>PROFIL KNOWME</small>
            <h1 style={{ margin: '5px 0' }}>{user.displayName}</h1>
            <AccountBadges
              staff={user.staff}
              verification={user.verification}
              premium={user.premium}
            />
            <p style={{ color: 'var(--muted)' }}>
              @{user.username} · {user.knowCoins ?? 0} KnowCoins
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              ID compte : {user.accountId ?? user.id}
            </p>
            {user.bio && <p>{user.bio}</p>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="btn" href={`/profile/${user.username}`}>
              Aperçu cosmétique
            </Link>
            <Link className="btn" href="/privacy/cosmetics">
              Confidentialité cosmétique
            </Link>
            <Link className="btn" href="/verification">
              Vérification
            </Link>
            <button className="btn" onClick={() => setEditing((value) => !value)}>
              {editing ? 'Annuler' : 'Modifier'}
            </button>
          </div>
        </div>

        {message && (
          <p role="status" style={{ color: 'var(--mint)' }}>
            {message}
          </p>
        )}

        {editing && (
          <form className="grid" onSubmit={updateProfile} style={{ marginTop: 22 }}>
            <input
              className="input"
              name="displayName"
              defaultValue={user.displayName}
              minLength={2}
              required
            />
            <textarea
              className="input"
              name="bio"
              defaultValue={user.bio ?? ''}
              placeholder="Parle un peu de toi..."
              rows={4}
              maxLength={500}
            />
            <button className="btn btn-primary">Enregistrer le profil</button>
          </form>
        )}

        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
            marginTop: 26
          }}
        >
          <article className="card" style={{ padding: 18 }}>
            <strong style={{ fontSize: 28 }}>{interests.length}</strong>
            <div style={{ color: 'var(--muted)' }}>Centres d’intérêt</div>
          </article>
          <article className="card" style={{ padding: 18 }}>
            <strong style={{ fontSize: 28 }}>{user.knowCoins ?? 0}</strong>
            <div style={{ color: 'var(--muted)' }}>KnowCoins</div>
          </article>
          <article className="card" style={{ padding: 18 }}>
            <strong style={{ fontSize: 28 }}>
              {user.verification ? 'Vérifié' : 'Actif'}
            </strong>
            <div style={{ color: 'var(--muted)' }}>Statut du compte</div>
          </article>
        </div>

        <h2>Centres d’intérêt</h2>
        <div
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}
        >
          {interests.length === 0 && (
            <span style={{ color: 'var(--muted)' }}>
              Aucun centre d’intérêt enregistré.
            </span>
          )}
          {interests.map((item) => (
            <span
              key={item.id}
              style={{
                background: 'var(--surface-2)',
                padding: '10px 14px',
                borderRadius: 999
              }}
            >
              {item.interest.name}
            </span>
          ))}
        </div>

        <form onSubmit={updateInterests} className="grid">
          <label htmlFor="interests">
            Modifier les intérêts, séparés par des virgules
          </label>
          <input
            id="interests"
            className="input"
            name="interests"
            defaultValue={interests
              .map((item) => item.interest.name)
              .join(', ')}
            placeholder="IA, musique, cybersécurité..."
            required
          />
          <button className="btn btn-accent">
            Mettre à jour mes intérêts
          </button>
        </form>
      </section>
    </main>
  );
}

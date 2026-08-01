'use client';

import { FormEvent, useState } from 'react';

type UserResult = {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
};

export default function FriendsPage() {
  const [results, setResults] = useState<UserResult[]>([]);
  const [message, setMessage] = useState('');

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const query = String(form.get('query') ?? '').trim();
    const token = localStorage.getItem('knowme_token');

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/social/search?q=${encodeURIComponent(query)}`,
      {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {}
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message ?? 'Recherche impossible.');
      return;
    }

    setResults(data);
    setMessage(
      data.length
        ? `${data.length} profil(s) trouvé(s).`
        : 'Aucun profil trouvé.'
    );
  }

  async function addFriend(addresseeId: string) {
    const token = localStorage.getItem('knowme_token');

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/social/friend-requests`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {})
        },
        body: JSON.stringify({ addresseeId })
      }
    );

    const data = await response.json();

    setMessage(
      response.ok
        ? 'Demande envoyée.'
        : data.message ?? 'Envoi impossible.'
    );
  }

  return (
    <main className="shell" style={{maxWidth:860,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--mint)'}}>CONNEXIONS</small>
        <h1>Trouver des personnes</h1>
      </header>

      <form
        className="card"
        onSubmit={search}
        style={{padding:18,display:'flex',gap:10}}
      >
        <input
          className="input"
          name="query"
          placeholder="Nom, pseudo ou centre d’intérêt..."
          minLength={2}
          required
        />
        <button className="btn btn-primary">
          Rechercher
        </button>
      </form>

      {message && <p style={{color:'var(--muted)'}}>{message}</p>}

      <section className="grid" style={{marginTop:18}}>
        {results.map((user) => (
          <article
            className="card"
            key={user.id}
            style={{
              padding:20,
              display:'grid',
              gridTemplateColumns:'56px 1fr auto',
              gap:16,
              alignItems:'center'
            }}
          >
            <div
              style={{
                width:56,
                height:56,
                borderRadius:'50%',
                background:'var(--surface-2)',
                display:'grid',
                placeItems:'center',
                fontWeight:900
              }}
            >
              {user.displayName[0]}
            </div>

            <div>
              <strong>{user.displayName}</strong>
              <div style={{color:'var(--muted)'}}>
                @{user.username}
              </div>
              {user.bio && <p>{user.bio}</p>}
            </div>

            <button
              className="btn btn-accent"
              onClick={() => addFriend(user.id)}
            >
              Ajouter
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

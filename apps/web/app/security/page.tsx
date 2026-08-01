'use client';

import { useEffect, useState } from 'react';

type Session = {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
};

export default function SecurityPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState('');

  async function loadSessions() {
    const token = localStorage.getItem('knowme_token');

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/auth/sessions`,
      {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {}
      }
    );

    const data = await response.json();

    if (response.ok) {
      setSessions(data);
    } else {
      setMessage(data.message ?? 'Impossible de charger les sessions.');
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function revoke(id: string) {
    const token = localStorage.getItem('knowme_token');

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/auth/sessions/${id}`,
      {
        method: 'DELETE',
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {}
      }
    );

    if (response.ok) {
      setSessions((current) =>
        current.filter((session) => session.id !== id)
      );
      setMessage('Session révoquée.');
    }
  }

  return (
    <main className="shell" style={{maxWidth:820,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--orange)'}}>SÉCURITÉ</small>
        <h1>Appareils connectés</h1>
      </header>

      {message && <p>{message}</p>}

      <section className="grid">
        {sessions.map((session) => (
          <article
            className="card"
            key={session.id}
            style={{padding:20}}
          >
            <strong>
              {session.userAgent ?? 'Appareil inconnu'}
            </strong>
            <p style={{color:'var(--muted)'}}>
              IP : {session.ipAddress ?? 'Non disponible'}
            </p>
            <p style={{color:'var(--muted)'}}>
              Expire le{' '}
              {new Date(session.expiresAt).toLocaleString('fr-FR')}
            </p>
            <button
              className="btn btn-accent"
              onClick={() => revoke(session.id)}
            >
              Déconnecter cet appareil
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

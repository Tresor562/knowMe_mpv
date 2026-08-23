'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, getAccessToken } from '../../../lib/api';

type GameCard = {
  key: string;
  version: number;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  categories: string[];
  modes: string[];
  estimatedMinutes: number;
  guestEligible: boolean;
  authoritativeServer: boolean;
  replayAvailable: boolean;
  economicStakeAllowed: boolean;
  favoritedAt?: string;
};

type LibraryCard = {
  sessionId: string;
  game: { key: string; version: number; name: string; description: string };
  status: string;
  participantStatus: string;
  yourTurn: boolean;
  updatedAt: string;
};

type GameLibrary = {
  favorites: GameCard[];
  continuePlaying: LibraryCard[];
  invitations: LibraryCard[];
  recent: LibraryCard[];
};

const EMPTY_LIBRARY: GameLibrary = {
  favorites: [],
  continuePlaying: [],
  invitations: [],
  recent: []
};

export default function GameCenterPage() {
  const [catalog, setCatalog] = useState<GameCard[]>([]);
  const [library, setLibrary] = useState<GameLibrary>(EMPTY_LIBRARY);
  const [authenticated, setAuthenticated] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load() {
    const hasSession = Boolean(getAccessToken());
    setAuthenticated(hasSession);
    const nextCatalog = await apiFetch<GameCard[]>('/games/center');
    setCatalog(nextCatalog);
    if (!hasSession) {
      setLibrary(EMPTY_LIBRARY);
      return;
    }
    try {
      setLibrary(await apiFetch<GameLibrary>('/games/library'));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Mes jeux sont momentanément indisponibles.');
    }
  }

  useEffect(() => {
    void load().catch((cause) =>
      setMessage(cause instanceof Error ? cause.message : 'Le Game Center est momentanément indisponible.')
    );
  }, []);

  const categories = useMemo(
    () => [...new Set(catalog.flatMap((game) => game.categories))].sort(),
    [catalog]
  );

  const visibleGames = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return catalog.filter((game) => {
      if (category && !game.categories.includes(category)) return false;
      if (!normalized) return true;
      return `${game.name} ${game.description} ${game.categories.join(' ')}`
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [catalog, category, query]);

  const favoriteKeys = useMemo(
    () => new Set(library.favorites.map((game) => game.key)),
    [library.favorites]
  );

  async function toggleFavorite(game: GameCard) {
    if (!authenticated) return;
    setBusyKey(game.key);
    setMessage('');
    try {
      await apiFetch(`/games/${game.key}/favorite`, {
        method: favoriteKeys.has(game.key) ? 'DELETE' : 'POST'
      });
      setLibrary(await apiFetch<GameLibrary>('/games/library'));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible de modifier ce favori.');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main className="shell" style={{ maxWidth: 1120, margin: '0 auto' }}>
      <header style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        <small style={{ color: 'var(--mint)', fontWeight: 800 }}>PLAY · GAME CENTER</small>
        <h1 style={{ margin: 0 }}>Joue à ta façon</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6, maxWidth: 760, margin: 0 }}>
          Découvre les jeux KnowMe sans obligation sociale. Ton compte sert seulement à conserver tes favoris,
          reprendre tes parties et retrouver tes invitations.
        </p>
        {!authenticated ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" href="/login">Se connecter pour sauvegarder</Link>
            <Link className="btn" href="/register">Créer un compte</Link>
          </div>
        ) : null}
      </header>

      {message ? <p role="status" style={{ color: 'var(--orange)' }}>{message}</p> : null}

      {authenticated && (library.continuePlaying.length || library.invitations.length) ? (
        <section className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Mes jeux</h2>
          {library.continuePlaying.length ? (
            <div style={{ marginBottom: 16 }}>
              <h3>Continuer</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {library.continuePlaying.map((item) => (
                  <Link key={item.sessionId} className="btn" href={`/games?session=${item.sessionId}`}>
                    {item.game.name} · {item.yourTurn ? 'À toi de jouer' : item.status}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {library.invitations.length ? (
            <div>
              <h3>Invitations</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {library.invitations.map((item) => (
                  <Link key={item.sessionId} className="btn" href={`/games?session=${item.sessionId}`}>
                    Rejoindre {item.game.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            aria-label="Rechercher un jeu"
            placeholder="Rechercher un jeu"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ flex: '1 1 260px' }}
          />
          <select
            className="input"
            aria-label="Filtrer par catégorie"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            style={{ minWidth: 190 }}
          >
            <option value="">Toutes les catégories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </section>

      <section aria-label="Catalogue de jeux" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {visibleGames.map((game) => (
          <article className="card" key={`${game.key}:${game.version}`} style={{ padding: 18, display: 'grid', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0 }}>{game.name}</h2>
              <small style={{ color: 'var(--muted)' }}>
                {game.estimatedMinutes} min · {game.modes.join(' / ')}
              </small>
            </div>
            <p style={{ color: 'var(--muted)', margin: 0 }}>{game.description}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {game.categories.map((item) => <small key={item}>#{item}</small>)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link
                className="btn btn-primary"
                href={game.guestEligible ? `/play/${game.key}` : `/games?game=${game.key}`}
              >
                {game.guestEligible ? 'Jouer maintenant' : 'Ouvrir'}
              </Link>
              {authenticated ? (
                <button className="btn" disabled={busyKey === game.key} onClick={() => void toggleFavorite(game)}>
                  {favoriteKeys.has(game.key) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      {!visibleGames.length ? (
        <p style={{ color: 'var(--muted)', marginTop: 20 }}>Aucun jeu ne correspond à ces filtres.</p>
      ) : null}
    </main>
  );
}

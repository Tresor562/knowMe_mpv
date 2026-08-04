'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';

type GameCatalogItem = {
  key: string;
  version: number;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  authoritativeServer: boolean;
  economicStakeAllowed: boolean;
  replayAvailable: boolean;
};

type GameParticipant = {
  userId: string;
  position: number;
  status: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
};

type GameSession = {
  id: string;
  game: GameCatalogItem & { rules?: Record<string, unknown> };
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'CANCELLED' | 'EXPIRED';
  sequence: number;
  state: {
    round?: number;
    maxRounds?: number;
    scores?: number[];
    pendingPosition?: number | null;
    lastOutcome?: Record<string, unknown> | null;
  };
  stateHash: string;
  currentTurnPosition: number | null;
  result?: Record<string, unknown> | null;
  viewerPosition: number;
  yourTurn: boolean;
  participants: GameParticipant[];
  expiresAt: string;
  updatedAt: string;
  replayed?: boolean;
};

type Replay = {
  sessionId: string;
  definitionKey: string;
  definitionVersion: number;
  result: Record<string, unknown>;
  actions: Array<{
    sequence: number;
    actorId: string;
    actionType: string;
    payload: Record<string, unknown>;
  }>;
  checksum: string;
  verified: boolean;
  reproducible: boolean;
  economicStake: null;
};

const TERMINAL = new Set(['COMPLETED', 'ABANDONED', 'CANCELLED', 'EXPIRED']);

function operationKey(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export default function GamesPage() {
  const [catalog, setCatalog] = useState<GameCatalogItem[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [selected, setSelected] = useState<GameSession | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [opponentUsername, setOpponentUsername] = useState('');
  const [pulse, setPulse] = useState(5);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const selectedParticipant = useMemo(
    () =>
      selected?.participants.find(
        (participant) => participant.position === selected.viewerPosition
      ),
    [selected]
  );

  async function refreshList() {
    const [nextCatalog, nextSessions] = await Promise.all([
      apiFetch<GameCatalogItem[]>('/games/catalog'),
      apiFetch<GameSession[]>('/games/sessions')
    ]);
    setCatalog(nextCatalog);
    setSessions(
      nextSessions.filter((session) => session.game.key === 'pulse-duel')
    );
    if (selected) {
      const current = await apiFetch<GameSession>(`/games/sessions/${selected.id}`);
      setSelected(current);
    }
  }

  useEffect(() => {
    void refreshList().catch((cause) =>
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.')
    );
  }, []);

  async function execute(task: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await task();
      await refreshList();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function createSession(event: FormEvent) {
    event.preventDefault();
    const username = opponentUsername.trim().replace(/^@/, '');
    if (!username) return;
    await execute(async () => {
      const created = await apiFetch<GameSession>('/games/sessions', {
        method: 'POST',
        body: JSON.stringify({
          gameKey: 'pulse-duel',
          opponentUsernames: [username],
          idempotencyKey: operationKey('web-game-create')
        })
      });
      setSelected(created);
      setReplay(null);
      setOpponentUsername('');
      setMessage('Invitation créée. Le serveur gardera le score et l’état officiels.');
    });
  }

  function openSession(sessionId: string) {
    void execute(async () => {
      const session = await apiFetch<GameSession>(`/games/sessions/${sessionId}`);
      setSelected(session);
      setReplay(null);
    });
  }

  function join() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<GameSession>(`/games/sessions/${selected.id}/join`, {
          method: 'POST'
        })
      );
    });
  }

  function reconnect() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<GameSession>(`/games/sessions/${selected.id}/reconnect`, {
          method: 'POST'
        })
      );
    });
  }

  function submitPulse() {
    if (!selected || !selected.yourTurn) return;
    void execute(async () => {
      setSelected(
        await apiFetch<GameSession>(`/games/sessions/${selected.id}/actions`, {
          method: 'POST',
          body: JSON.stringify({
            actionType: 'PULSE',
            payload: { value: pulse },
            expectedSequence: selected.sequence,
            idempotencyKey: operationKey(`web-game-action-${selected.sequence + 1}`)
          })
        })
      );
    });
  }

  function cancel() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<GameSession>(`/games/sessions/${selected.id}`, {
          method: 'DELETE'
        })
      );
    });
  }

  function abandon() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<GameSession>(`/games/sessions/${selected.id}/abandon`, {
          method: 'POST'
        })
      );
    });
  }

  function loadReplay() {
    if (!selected) return;
    void execute(async () => {
      setReplay(
        await apiFetch<Replay>(`/games/sessions/${selected.id}/replay`)
      );
    });
  }

  return (
    <main className="shell" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <header style={{ marginBottom: 22 }}>
        <small style={{ color: 'var(--mint)', fontWeight: 800 }}>
          KMD-052 · GAME PLATFORM
        </small>
        <h1>Jeux KnowMe autoritaires</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Le serveur valide chaque tour, calcule le résultat et produit le replay. Aucun score,
          gagnant ou mise n’est accepté depuis le client.
        </p>
        <a href="/games/affinity" style={{ color: 'var(--mint)' }}>
          Ouvrir le Miroir d’affinité volontaire
        </a>
      </header>

      {message ? (
        <p role="status" style={{ color: 'var(--orange)' }}>
          {message}
        </p>
      ) : null}

      <section className="card" style={{ padding: 22, marginBottom: 20 }}>
        <h2>Nouvelle partie Pulse Duel</h2>
        <form onSubmit={createSession} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            value={opponentUsername}
            onChange={(event) => setOpponentUsername(event.target.value)}
            placeholder="Pseudo de ton adversaire"
            minLength={3}
            maxLength={30}
            required
            style={{ flex: '1 1 250px' }}
          />
          <button
            className="btn btn-primary"
            disabled={busy || !catalog.some((item) => item.key === 'pulse-duel')}
          >
            Inviter à Pulse Duel
          </button>
        </form>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Duel gratuit, sans mise, en cinq manches. Le premier choix reste caché jusqu’au second.
        </p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 0.8fr) minmax(0, 1.4fr)', gap: 18 }}>
        <section className="card" style={{ padding: 18 }}>
          <h2>Mes parties Pulse Duel</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {sessions.map((session) => (
              <button
                key={session.id}
                className="btn"
                onClick={() => openSession(session.id)}
                disabled={busy}
                style={{ textAlign: 'left', justifyContent: 'space-between' }}
              >
                <span>{session.game.name}</span>
                <small>{session.status}{session.yourTurn ? ' · À toi' : ''}</small>
              </button>
            ))}
            {!sessions.length ? <p style={{ color: 'var(--muted)' }}>Aucune partie.</p> : null}
          </div>
        </section>

        <section className="card" style={{ padding: 22, minHeight: 360 }}>
          {!selected ? (
            <p style={{ color: 'var(--muted)' }}>Sélectionne ou crée une partie.</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ marginBottom: 4 }}>{selected.game.name}</h2>
                  <small>{selected.status} · séquence {selected.sequence}</small>
                </div>
                <button className="btn" onClick={reconnect} disabled={busy}>Resynchroniser</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, margin: '18px 0' }}>
                {selected.participants.map((participant) => (
                  <div key={participant.userId} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
                    <strong>{participant.user?.displayName ?? 'Compte supprimé'}</strong>
                    <div style={{ color: 'var(--muted)' }}>Position {participant.position + 1}</div>
                    <small>{participant.status}</small>
                  </div>
                ))}
              </div>

              {selected.status === 'WAITING' && selectedParticipant?.status === 'INVITED' ? (
                <button className="btn btn-primary" onClick={join} disabled={busy}>Rejoindre</button>
              ) : null}

              {selected.status === 'ACTIVE' ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    <strong>Manche {selected.state.round}/{selected.state.maxRounds}</strong>
                    <span>Scores : {(selected.state.scores ?? []).join(' — ')}</span>
                    <span>{selected.yourTurn ? 'À toi de jouer' : 'En attente de l’autre joueur'}</span>
                  </div>
                  {selected.yourTurn ? (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <select className="input" value={pulse} onChange={(event) => setPulse(Number(event.target.value))} style={{ width: 120 }}>
                        {Array.from({ length: 9 }, (_, index) => index + 1).map((value) => <option key={value}>{value}</option>)}
                      </select>
                      <button className="btn btn-primary" onClick={submitPulse} disabled={busy}>Envoyer mon choix</button>
                    </div>
                  ) : null}
                  <button className="btn" onClick={abandon} disabled={busy}>Abandonner la partie</button>
                </div>
              ) : null}

              {selected.status === 'WAITING' && selected.viewerPosition === 0 ? (
                <button className="btn" onClick={cancel} disabled={busy}>Annuler l’invitation</button>
              ) : null}

              {TERMINAL.has(selected.status) ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {JSON.stringify(selected.result, null, 2)}
                  </pre>
                  <button className="btn btn-primary" onClick={loadReplay} disabled={busy}>Vérifier le replay</button>
                </div>
              ) : null}

              {replay ? (
                <section style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                  <h3>Replay {replay.verified ? 'vérifié' : 'invalide'}</h3>
                  <p style={{ color: 'var(--muted)' }}>
                    {replay.actions.length} actions · checksum {replay.checksum.slice(0, 16)}… · reproductible : {replay.reproducible ? 'oui' : 'non'}
                  </p>
                </section>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

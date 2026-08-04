'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type TournamentSummary = {
  id: string;
  name: string;
  description: string | null;
  game: { key: string; version: number };
  format: 'SINGLE_ELIMINATION';
  teamSize: number;
  maxEntrants: number;
  status: string;
  registrationClosesAt: string;
  entrantCounts: Record<string, number>;
  economicStake: null;
  serverAuthoritative: true;
};

type TournamentView = {
  id: string;
  name: string;
  description: string | null;
  game: { key: string; version: number };
  format: 'SINGLE_ELIMINATION';
  teamSize: number;
  maxEntrants: number;
  status: string;
  bracketSize: number | null;
  championEntrantId: string | null;
  registrationClosesAt: string;
  startedAt: string | null;
  completedAt: string | null;
  viewer: {
    owner: boolean;
    member: boolean;
    entrantId: string | null;
    invitationPending: boolean;
    captain: boolean;
  };
  entrants: Array<{
    id: string;
    name: string;
    seed: number | null;
    status: string;
    captainId: string;
    members: Array<{
      userId: string;
      role: string;
      status: string;
      user: {
        id: string;
        username: string;
        displayName: string;
      } | null;
    }>;
  }>;
  matches: Array<{
    id: string;
    round: number;
    position: number;
    firstEntrantId: string | null;
    secondEntrantId: string | null;
    winnerEntrantId: string | null;
    status: string;
    gameSessionId: string | null;
    gameSession: { id: string; status: string } | null;
    resolutionReason: string | null;
  }>;
  policy: {
    serverAuthoritative: true;
    clientWinnerAccepted: false;
    clientScoreAccepted: false;
    economicStakeAllowed: false;
    paidPriorityAllowed: false;
    captainRepresentsTeam: true;
    bracketSeedExposed: false;
  };
  replayed?: boolean;
};

function operationKey(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export default function TournamentsPage() {
  const [open, setOpen] = useState<TournamentSummary[]>([]);
  const [mine, setMine] = useState<TournamentSummary[]>([]);
  const [selected, setSelected] = useState<TournamentView | null>(null);
  const [name, setName] = useState('KnowMe Pulse Cup');
  const [description, setDescription] = useState('Tournoi gratuit à élimination directe.');
  const [teamSize, setTeamSize] = useState(1);
  const [maxEntrants, setMaxEntrants] = useState(4);
  const [closesAt, setClosesAt] = useState(() => {
    const value = new Date(Date.now() + 24 * 60 * 60 * 1_000);
    return value.toISOString().slice(0, 16);
  });
  const [teamName, setTeamName] = useState('');
  const [memberUsernames, setMemberUsernames] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refreshLists() {
    const [nextOpen, nextMine] = await Promise.all([
      apiFetch<TournamentSummary[]>('/tournaments/open'),
      apiFetch<TournamentSummary[]>('/tournaments/mine')
    ]);
    setOpen(nextOpen);
    setMine(nextMine);
    if (selected) {
      setSelected(await apiFetch<TournamentView>(`/tournaments/${selected.id}`));
    }
  }

  useEffect(() => {
    void refreshLists().catch((cause) =>
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.')
    );
  }, []);

  async function execute(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await task();
      await refreshLists();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  function openTournament(id: string) {
    void execute(async () => {
      setSelected(await apiFetch<TournamentView>(`/tournaments/${id}`));
    });
  }

  function createTournament(event: FormEvent) {
    event.preventDefault();
    void execute(async () => {
      const created = await apiFetch<TournamentView>('/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          gameKey: 'pulse-duel',
          teamSize,
          maxEntrants,
          registrationClosesAt: new Date(closesAt).toISOString(),
          idempotencyKey: operationKey('web-tournament-create')
        })
      });
      setSelected(created);
      setMessage('Tournoi créé. Ouvre les inscriptions lorsque les paramètres sont vérifiés.');
    });
  }

  function operation(path: string, confirmation: string) {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<TournamentView>(`/tournaments/${selected.id}${path}`, {
          method: 'POST',
          body: JSON.stringify({
            idempotencyKey: operationKey(`web-tournament-${path.replaceAll('/', '-')}`)
          })
        })
      );
      setMessage(confirmation);
    });
  }

  function registerEntrant(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const members = memberUsernames
      .split(',')
      .map((value) => value.trim().replace(/^@/, ''))
      .filter(Boolean);
    void execute(async () => {
      setSelected(
        await apiFetch<TournamentView>(`/tournaments/${selected.id}/entrants`, {
          method: 'POST',
          body: JSON.stringify({
            teamName: selected.teamSize > 1 ? teamName : undefined,
            memberUsernames: members,
            idempotencyKey: operationKey('web-tournament-register')
          })
        })
      );
      setMessage('Inscription enregistrée. Les membres invités doivent accepter explicitement.');
    });
  }

  function syncMatch(matchId: string) {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<TournamentView>(
          `/tournaments/${selected.id}/matches/${matchId}/sync`,
          { method: 'POST' }
        )
      );
      setMessage('Le bracket a été synchronisé avec le résultat serveur de la partie.');
    });
  }

  function cancelTournament() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<TournamentView>(`/tournaments/${selected.id}`, {
          method: 'DELETE',
          body: JSON.stringify({
            idempotencyKey: operationKey('web-tournament-cancel')
          })
        })
      );
    });
  }

  const entrantMap = new Map(
    (selected?.entrants ?? []).map((entrant) => [entrant.id, entrant])
  );

  return (
    <main className="shell" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <header style={{ marginBottom: 22 }}>
        <small style={{ color: 'var(--mint)', fontWeight: 800 }}>
          KMD-056 · TOURNOIS AUTORITAIRES
        </small>
        <h1>Tournois KnowMe sans mise</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Le serveur génère le bracket et fait avancer uniquement le résultat d’une vraie partie
          KnowMe terminée. Aucun score, gagnant, KnowCoin, mise ou priorité payante n’est accepté.
        </p>
        <a href="/games" style={{ color: 'var(--mint)' }}>
          Ouvrir les parties autoritaires
        </a>
      </header>

      {message ? <p role="status" style={{ color: 'var(--orange)' }}>{message}</p> : null}

      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <h2>Créer un tournoi Pulse Duel</h2>
        <form onSubmit={createTournament} style={{ display: 'grid', gap: 12 }}>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required />
          <textarea className="input" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <label>
              Taille d’équipe
              <select className="input" value={teamSize} onChange={(event) => setTeamSize(Number(event.target.value))} style={{ width: '100%' }}>
                {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Capacité
              <select className="input" value={maxEntrants} onChange={(event) => setMaxEntrants(Number(event.target.value))} style={{ width: '100%' }}>
                {[2, 4, 8, 16, 32].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Clôture
              <input className="input" type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} required style={{ width: '100%' }} />
            </label>
          </div>
          <button className="btn btn-primary" disabled={busy}>Créer le brouillon</button>
        </form>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 0.7fr) minmax(0, 1.5fr)', gap: 18 }}>
        <aside style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <TournamentList title="Mes tournois" items={mine} busy={busy} onOpen={openTournament} />
          <TournamentList title="Inscriptions ouvertes" items={open} busy={busy} onOpen={openTournament} />
        </aside>

        <section className="card" style={{ padding: 22, minHeight: 420 }}>
          {!selected ? (
            <p style={{ color: 'var(--muted)' }}>Sélectionne ou crée un tournoi.</p>
          ) : (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <h2 style={{ marginBottom: 4 }}>{selected.name}</h2>
                <p style={{ color: 'var(--muted)' }}>{selected.description}</p>
                <strong>{selected.status} · {selected.teamSize} membre(s) par équipe · {selected.maxEntrants} entrants maximum</strong>
              </div>

              <p style={{ color: 'var(--muted)' }}>
                Serveur autoritaire : oui · résultat client : interdit · mise : interdite · seed privée : oui · capitaine représentant : oui
              </p>

              {selected.viewer.owner && selected.status === 'DRAFT' ? (
                <button className="btn btn-primary" disabled={busy} onClick={() => operation('/registration/open', 'Inscriptions ouvertes.')}>
                  Ouvrir les inscriptions
                </button>
              ) : null}

              {selected.status === 'REGISTRATION_OPEN' && !selected.viewer.member ? (
                <form onSubmit={registerEntrant} style={{ display: 'grid', gap: 10 }}>
                  <h3>S’inscrire</h3>
                  {selected.teamSize > 1 ? (
                    <>
                      <input className="input" value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Nom de l’équipe" maxLength={80} required />
                      <input className="input" value={memberUsernames} onChange={(event) => setMemberUsernames(event.target.value)} placeholder={`${selected.teamSize - 1} pseudo(s), séparés par des virgules`} required />
                    </>
                  ) : null}
                  <button className="btn btn-primary" disabled={busy}>Enregistrer l’inscription</button>
                </form>
              ) : null}

              {selected.viewer.invitationPending ? (
                <button className="btn btn-primary" disabled={busy} onClick={() => operation('/invitations/accept', 'Invitation acceptée.')}>
                  Accepter l’invitation d’équipe
                </button>
              ) : null}

              {selected.viewer.owner && selected.status === 'REGISTRATION_OPEN' ? (
                <button className="btn btn-primary" disabled={busy} onClick={() => operation('/start', 'Bracket généré par le serveur.')}>
                  Démarrer lorsque la capacité est atteinte
                </button>
              ) : null}

              {selected.viewer.member && !['COMPLETED', 'CANCELLED'].includes(selected.status) ? (
                <button className="btn" disabled={busy} onClick={() => operation('/withdraw', 'Ton entrant a été retiré ou déclaré forfait.')}>
                  Retirer mon équipe / déclarer forfait
                </button>
              ) : null}

              {selected.viewer.owner && ['DRAFT', 'REGISTRATION_OPEN'].includes(selected.status) ? (
                <button className="btn" disabled={busy} onClick={cancelTournament}>Annuler le tournoi</button>
              ) : null}

              <section>
                <h3>Entrants</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {selected.entrants.map((entrant) => (
                    <div key={entrant.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                      <strong>#{entrant.seed ?? '—'} {entrant.name}</strong> · {entrant.status}
                      <div style={{ color: 'var(--muted)', marginTop: 6 }}>
                        {entrant.members.map((member) => member.user?.displayName ?? 'Compte supprimé').join(' · ')}
                      </div>
                    </div>
                  ))}
                  {!selected.entrants.length ? <p style={{ color: 'var(--muted)' }}>Aucune inscription.</p> : null}
                </div>
              </section>

              <section>
                <h3>Bracket</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  {selected.matches.map((match) => {
                    const first = match.firstEntrantId ? entrantMap.get(match.firstEntrantId) : null;
                    const second = match.secondEntrantId ? entrantMap.get(match.secondEntrantId) : null;
                    const winner = match.winnerEntrantId ? entrantMap.get(match.winnerEntrantId) : null;
                    return (
                      <div key={match.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
                        <strong>Tour {match.round} · Match {match.position + 1}</strong>
                        <p>{first?.name ?? 'À déterminer'} contre {second?.name ?? 'À déterminer'}</p>
                        <p style={{ color: 'var(--muted)' }}>État : {match.status}{winner ? ` · gagnant serveur : ${winner.name}` : ''}</p>
                        {match.gameSessionId ? (
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <a className="btn" href={`/games?session=${match.gameSessionId}`}>Ouvrir la partie</a>
                            {selected.viewer.member || selected.viewer.owner ? (
                              <button className="btn" disabled={busy} onClick={() => syncMatch(match.id)}>Synchroniser le résultat serveur</button>
                            ) : null}
                          </div>
                        ) : null}
                        {match.status === 'REVIEW_REQUIRED' ? (
                          <p style={{ color: 'var(--orange)', fontWeight: 800 }}>Résolution réservée à la modération.</p>
                        ) : null}
                      </div>
                    );
                  })}
                  {!selected.matches.length ? <p style={{ color: 'var(--muted)' }}>Le bracket sera généré au démarrage.</p> : null}
                </div>
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function TournamentList({
  title,
  items,
  busy,
  onOpen
}: {
  title: string;
  items: TournamentSummary[];
  busy: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="card" style={{ padding: 16 }}>
      <h2>{title}</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((item) => (
          <button key={item.id} className="btn" disabled={busy} onClick={() => onOpen(item.id)} style={{ textAlign: 'left' }}>
            <span>{item.name}</span>
            <small>{item.status} · {item.entrantCounts.READY ?? 0}/{item.maxEntrants}</small>
          </button>
        ))}
        {!items.length ? <p style={{ color: 'var(--muted)' }}>Aucun tournoi.</p> : null}
      </div>
    </section>
  );
}

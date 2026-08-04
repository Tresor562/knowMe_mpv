'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';

type AffinityPreference = {
  userId: string;
  invitationsEnabled: boolean;
  friendsOnly: boolean;
  defaultShareAnswers: boolean;
  version: number;
};

type Participant = {
  userId: string;
  position: number;
  status: string;
  user: { displayName: string; username: string } | null;
};

type AffinitySummary = {
  title: string;
  overallScore: number;
  exactMatches: number;
  questionCount: number;
  categories: Array<{
    key: string;
    label: string;
    score: number;
    exactMatches: number;
    questionCount: number;
  }>;
  explanations: string[];
  disclaimer: string;
  detailedAnswersShared: boolean;
  answerDetails?: Array<{
    questionKey: string;
    prompt: string;
    firstChoice: string;
    secondChoice: string;
  }>;
};

type AffinitySession = {
  id: string;
  game: { key: string; name: string; description: string };
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'CANCELLED' | 'EXPIRED';
  sequence: number;
  state: {
    phase: 'CONSENT' | 'QUESTIONS' | 'COMPLETED';
    consentCount: number;
    questionIndex: number;
    questionCount: number;
    question: {
      key: string;
      category: string;
      prompt: string;
      options: string[];
    } | null;
    answeredPositions: number[];
    completedRounds: number;
    summary: AffinitySummary | null;
    disclaimer: string;
  };
  currentTurnPosition: number | null;
  result: AffinitySummary | Record<string, unknown> | null;
  viewerPosition: number;
  yourTurn: boolean;
  participants: Participant[];
};

type AffinityReplay = {
  verified: boolean;
  verificationScope: 'SERVER';
  reproducible: boolean;
  interpretable: boolean;
  privacyRedacted: boolean;
  detailedAnswersShared: boolean;
  seed: null;
  actions: Array<{
    sequence: number;
    actorId: string;
    actionType: string;
    payload: Record<string, unknown>;
  }>;
};

const TERMINAL = new Set(['COMPLETED', 'ABANDONED', 'CANCELLED', 'EXPIRED']);

function operationKey(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export default function AffinityGamePage() {
  const [preference, setPreference] = useState<AffinityPreference | null>(null);
  const [sessions, setSessions] = useState<AffinitySession[]>([]);
  const [selected, setSelected] = useState<AffinitySession | null>(null);
  const [opponentUsername, setOpponentUsername] = useState('');
  const [shareAnswers, setShareAnswers] = useState(false);
  const [replay, setReplay] = useState<AffinityReplay | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const viewer = useMemo(
    () =>
      selected?.participants.find(
        (participant) => participant.position === selected.viewerPosition
      ),
    [selected]
  );

  async function refresh() {
    const [nextPreference, allSessions] = await Promise.all([
      apiFetch<AffinityPreference>('/games/affinity/preferences'),
      apiFetch<AffinitySession[]>('/games/sessions')
    ]);
    setPreference(nextPreference);
    setShareAnswers((current) =>
      preference ? current : nextPreference.defaultShareAnswers
    );
    setSessions(
      allSessions.filter((session) => session.game.key === 'affinity-mirror')
    );
    if (selected) {
      setSelected(
        await apiFetch<AffinitySession>(`/games/sessions/${selected.id}`)
      );
    }
  }

  useEffect(() => {
    void refresh().catch((cause) =>
      setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.')
    );
  }, []);

  async function execute(task: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await task();
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  function updatePreference(patch: Partial<AffinityPreference>) {
    void execute(async () => {
      const next = await apiFetch<AffinityPreference>(
        '/games/affinity/preferences',
        {
          method: 'PATCH',
          body: JSON.stringify(patch)
        }
      );
      setPreference(next);
      setShareAnswers(next.defaultShareAnswers);
      setMessage('Préférences d’affinité enregistrées.');
    });
  }

  function create(event: FormEvent) {
    event.preventDefault();
    const username = opponentUsername.trim().replace(/^@/, '');
    if (!username) return;
    void execute(async () => {
      const session = await apiFetch<AffinitySession>('/games/sessions', {
        method: 'POST',
        body: JSON.stringify({
          gameKey: 'affinity-mirror',
          opponentUsernames: [username],
          idempotencyKey: operationKey('web-affinity-create')
        })
      });
      setSelected(session);
      setReplay(null);
      setOpponentUsername('');
      setMessage('Invitation créée. Les deux consentements restent nécessaires.');
    });
  }

  function open(sessionId: string) {
    void execute(async () => {
      setSelected(
        await apiFetch<AffinitySession>(`/games/sessions/${sessionId}`)
      );
      setReplay(null);
    });
  }

  function join() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<AffinitySession>(`/games/sessions/${selected.id}/join`, {
          method: 'POST'
        })
      );
    });
  }

  function consent() {
    if (!selected?.yourTurn) return;
    void execute(async () => {
      setSelected(
        await apiFetch<AffinitySession>(
          `/games/sessions/${selected.id}/actions`,
          {
            method: 'POST',
            body: JSON.stringify({
              actionType: 'CONSENT',
              payload: { accepted: true, shareAnswers },
              expectedSequence: selected.sequence,
              idempotencyKey: operationKey(
                `web-affinity-consent-${selected.sequence + 1}`
              )
            })
          }
        )
      );
    });
  }

  function answer(option: number) {
    if (!selected?.yourTurn || selected.state.phase !== 'QUESTIONS') return;
    void execute(async () => {
      setSelected(
        await apiFetch<AffinitySession>(
          `/games/sessions/${selected.id}/actions`,
          {
            method: 'POST',
            body: JSON.stringify({
              actionType: 'ANSWER',
              payload: { option },
              expectedSequence: selected.sequence,
              idempotencyKey: operationKey(
                `web-affinity-answer-${selected.sequence + 1}`
              )
            })
          }
        )
      );
    });
  }

  function leave() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<AffinitySession>(
          `/games/sessions/${selected.id}/abandon`,
          { method: 'POST' }
        )
      );
    });
  }

  function verifyReplay() {
    if (!selected) return;
    void execute(async () => {
      setReplay(
        await apiFetch<AffinityReplay>(
          `/games/sessions/${selected.id}/replay`
        )
      );
    });
  }

  const summary =
    selected?.state.summary ??
    (selected?.result && 'overallScore' in selected.result
      ? (selected.result as AffinitySummary)
      : null);

  return (
    <main className="shell" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <header style={{ marginBottom: 22 }}>
        <small style={{ color: 'var(--mint)', fontWeight: 800 }}>
          KMD-053 · JEU VOLONTAIRE
        </small>
        <h1>Miroir d’affinité</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Comparez six préférences avec consentement mutuel. Le résultat décrit vos réponses ;
          il ne juge pas votre relation et ne prédit rien.
        </p>
        <a href="/games" style={{ color: 'var(--mint)' }}>
          Retour à Pulse Duel
        </a>
      </header>

      {message ? (
        <p role="status" style={{ color: 'var(--orange)' }}>
          {message}
        </p>
      ) : null}

      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <h2>Confidentialité</h2>
        {preference ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <label>
              <input
                type="checkbox"
                checked={preference.invitationsEnabled}
                onChange={(event) =>
                  updatePreference({ invitationsEnabled: event.target.checked })
                }
                disabled={busy}
              />{' '}
              Accepter les invitations à ce jeu
            </label>
            <label>
              <input
                type="checkbox"
                checked={preference.friendsOnly}
                onChange={(event) =>
                  updatePreference({ friendsOnly: event.target.checked })
                }
                disabled={busy}
              />{' '}
              Réserver les invitations à mes amis
            </label>
            <label>
              <input
                type="checkbox"
                checked={preference.defaultShareAnswers}
                onChange={(event) =>
                  updatePreference({ defaultShareAnswers: event.target.checked })
                }
                disabled={busy}
              />{' '}
              Proposer par défaut le partage des réponses détaillées
            </label>
          </div>
        ) : null}
      </section>

      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <h2>Nouvel instantané</h2>
        <form onSubmit={create} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            value={opponentUsername}
            onChange={(event) => setOpponentUsername(event.target.value)}
            placeholder="Pseudo de ton ami"
            minLength={3}
            maxLength={30}
            required
            style={{ flex: '1 1 250px' }}
          />
          <button className="btn btn-primary" disabled={busy}>
            Inviter
          </button>
        </form>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, .75fr) minmax(0, 1.5fr)', gap: 18 }}>
        <section className="card" style={{ padding: 18 }}>
          <h2>Mes instantanés</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {sessions.map((session) => (
              <button
                key={session.id}
                className="btn"
                onClick={() => open(session.id)}
                disabled={busy}
                style={{ textAlign: 'left', justifyContent: 'space-between' }}
              >
                <span>{session.game.name}</span>
                <small>{session.status}{session.yourTurn ? ' · À toi' : ''}</small>
              </button>
            ))}
            {!sessions.length ? (
              <p style={{ color: 'var(--muted)' }}>Aucun instantané.</p>
            ) : null}
          </div>
        </section>

        <section className="card" style={{ padding: 22, minHeight: 390 }}>
          {!selected ? (
            <p style={{ color: 'var(--muted)' }}>Sélectionne ou crée un instantané.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <h2 style={{ marginBottom: 4 }}>{selected.game.name}</h2>
                <small>{selected.status} · séquence {selected.sequence}</small>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {selected.participants.map((participant) => (
                  <div key={participant.userId} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12 }}>
                    <strong>{participant.user?.displayName ?? 'Compte supprimé'}</strong>
                    <div style={{ color: 'var(--muted)' }}>{participant.status}</div>
                  </div>
                ))}
              </div>

              {selected.status === 'WAITING' && viewer?.status === 'INVITED' ? (
                <button className="btn btn-primary" onClick={join} disabled={busy}>
                  Rejoindre volontairement
                </button>
              ) : null}

              {selected.status === 'ACTIVE' && selected.state.phase === 'CONSENT' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <p>{selected.state.disclaimer}</p>
                  {selected.yourTurn ? (
                    <>
                      <label>
                        <input
                          type="checkbox"
                          checked={shareAnswers}
                          onChange={(event) => setShareAnswers(event.target.checked)}
                        />{' '}
                        Partager les réponses détaillées seulement si l’autre personne choisit aussi de les partager
                      </label>
                      <button className="btn btn-primary" onClick={consent} disabled={busy}>
                        Je consens à participer
                      </button>
                    </>
                  ) : (
                    <p style={{ color: 'var(--muted)' }}>En attente du consentement de l’autre personne.</p>
                  )}
                </div>
              ) : null}

              {selected.status === 'ACTIVE' && selected.state.phase === 'QUESTIONS' ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <small>
                    Question {selected.state.questionIndex + 1}/{selected.state.questionCount}
                  </small>
                  <h3>{selected.state.question?.prompt}</h3>
                  {selected.yourTurn ? (
                    <div style={{ display: 'grid', gap: 9 }}>
                      {selected.state.question?.options.map((option, index) => (
                        <button
                          key={option}
                          className="btn"
                          onClick={() => answer(index)}
                          disabled={busy}
                          style={{ textAlign: 'left' }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--muted)' }}>
                      Ta réponse reste cachée pendant que l’autre personne choisit.
                    </p>
                  )}
                  <button className="btn" onClick={leave} disabled={busy}>
                    Quitter le jeu
                  </button>
                </div>
              ) : null}

              {summary ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <h3>{summary.title}</h3>
                  <strong style={{ fontSize: 30 }}>{summary.overallScore}/100</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                    {summary.categories.map((category) => (
                      <div key={category.key} style={{ padding: 13, border: '1px solid var(--border)', borderRadius: 12 }}>
                        <strong>{category.label}</strong>
                        <div>{category.score}/100</div>
                        <small>{category.exactMatches}/{category.questionCount} choix identiques</small>
                      </div>
                    ))}
                  </div>
                  {summary.explanations.map((explanation) => (
                    <p key={explanation} style={{ margin: 0 }}>{explanation}</p>
                  ))}
                  <p style={{ color: 'var(--orange)', fontWeight: 700 }}>{summary.disclaimer}</p>
                  {summary.answerDetails ? (
                    <details>
                      <summary>Réponses détaillées partagées mutuellement</summary>
                      {summary.answerDetails.map((detail) => (
                        <div key={detail.questionKey} style={{ marginTop: 10 }}>
                          <strong>{detail.prompt}</strong>
                          <div>{detail.firstChoice} · {detail.secondChoice}</div>
                        </div>
                      ))}
                    </details>
                  ) : null}
                  <button className="btn btn-primary" onClick={verifyReplay} disabled={busy}>
                    Vérifier le replay privé
                  </button>
                </div>
              ) : null}

              {TERMINAL.has(selected.status) && !summary ? (
                <p style={{ color: 'var(--muted)' }}>
                  Cet instantané s’est terminé sans résultat comparatif.
                </p>
              ) : null}

              {replay ? (
                <p style={{ color: replay.verified ? 'var(--mint)' : 'var(--orange)' }}>
                  Replay {replay.verified ? 'vérifié par le serveur' : 'invalide'} ·{' '}
                  {replay.privacyRedacted ? 'réponses expurgées' : 'détails partagés mutuellement'}
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

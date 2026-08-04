'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type Preference = {
  matchmakingEnabled: boolean;
  allowNewPeople: boolean;
  version: number;
};

type Queue = {
  id: string;
  purpose: string;
  pace: string;
  languages: string[];
  topics: string[];
  availability: Array<{
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
  }>;
  status: string;
  expiresAt: string;
};

type Proposal = {
  id: string;
  status: string;
  score: number;
  explanation: {
    sharedLanguages: string[];
    sharedTopics: string[];
    overlapMinutes: number;
    paceReason: string;
    explanations: string[];
    sensitiveCriteriaUsed: false;
    affinityAnswersUsed: false;
    privateMessagesUsed: false;
    preciseLocationUsed: false;
  };
  partner: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
  } | null;
  yourDecision: 'ACCEPT' | 'DECLINE' | 'BLOCK' | null;
  partnerResponded: boolean;
  expiresAt: string;
};

type MatchStatus = {
  queue: Queue | null;
  proposal: Proposal | null;
  sensitiveCriteriaUsed: false;
  replayed?: boolean;
};

type BlockedUser = {
  blockedId: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
  } | null;
};

const TOPICS = [
  'TECH',
  'MUSIC',
  'ANIME',
  'GAMING',
  'ART',
  'SCIENCE',
  'ENTREPRENEURSHIP',
  'SPORTS',
  'MOVIES',
  'BOOKS',
  'LANGUAGES',
  'COOKING',
  'TRAVEL_IDEAS'
];

function operationKey(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function minutesLabel(value: number) {
  const hours = Math.floor(value / 60).toString().padStart(2, '0');
  const minutes = (value % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function MatchmakingPage() {
  const [preference, setPreference] = useState<Preference | null>(null);
  const [status, setStatus] = useState<MatchStatus | null>(null);
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [purpose, setPurpose] = useState('LEARN');
  const [pace, setPace] = useState('FLEXIBLE');
  const [languages, setLanguages] = useState('fr,en');
  const [topics, setTopics] = useState<string[]>(['TECH', 'BOOKS']);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startMinute, setStartMinute] = useState(900);
  const [endMinute, setEndMinute] = useState(1020);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const [nextPreference, nextStatus, nextBlocks] = await Promise.all([
      apiFetch<Preference>('/social-matchmaking/preferences'),
      apiFetch<MatchStatus>('/social-matchmaking/status'),
      apiFetch<BlockedUser[]>('/social-matchmaking/blocks')
    ]);
    setPreference(nextPreference);
    setStatus(nextStatus);
    setBlocks(nextBlocks);
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

  function updatePreference(patch: Partial<Preference>) {
    void execute(async () => {
      setPreference(
        await apiFetch<Preference>('/social-matchmaking/preferences', {
          method: 'PATCH',
          body: JSON.stringify(patch)
        })
      );
    });
  }

  function toggleTopic(topic: string) {
    setTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : current.length < 8
          ? [...current, topic]
          : current
    );
  }

  function join() {
    void execute(async () => {
      const normalizedLanguages = [
        ...new Set(
          languages
            .split(',')
            .map((language) => language.trim().toLowerCase())
            .filter(Boolean)
        )
      ];
      setStatus(
        await apiFetch<MatchStatus>('/social-matchmaking/queue', {
          method: 'POST',
          body: JSON.stringify({
            purpose,
            pace,
            languages: normalizedLanguages,
            topics,
            availability: [{ dayOfWeek, startMinute, endMinute }],
            idempotencyKey: operationKey('web-social-match-join')
          })
        })
      );
      setMessage('File rejointe avec uniquement les critères affichés.');
    });
  }

  function leave() {
    void execute(async () => {
      await apiFetch('/social-matchmaking/queue', { method: 'DELETE' });
      setMessage('Tu as quitté immédiatement la file.');
    });
  }

  function decide(decision: 'ACCEPT' | 'DECLINE' | 'BLOCK') {
    if (!status?.proposal) return;
    void execute(async () => {
      setStatus(
        await apiFetch<MatchStatus>(
          `/social-matchmaking/proposals/${status.proposal.id}/decision`,
          {
            method: 'POST',
            body: JSON.stringify({
              decision,
              idempotencyKey: operationKey(`web-social-match-${decision.toLowerCase()}`)
            })
          }
        )
      );
    });
  }

  function unblock(blockedId: string) {
    void execute(async () => {
      await apiFetch(`/social-matchmaking/blocks/${blockedId}`, {
        method: 'DELETE'
      });
    });
  }

  const canJoin =
    preference?.matchmakingEnabled &&
    preference.allowNewPeople &&
    topics.length > 0 &&
    languages.trim().length > 0 &&
    endMinute - startMinute >= 30;

  return (
    <main className="shell" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <header style={{ marginBottom: 22 }}>
        <small style={{ color: 'var(--mint)', fontWeight: 800 }}>
          KMD-054 · MATCHMAKING VOLONTAIRE
        </small>
        <h1>Rencontres sociales explicables</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          L’appariement utilise seulement l’objectif, le rythme, les langues, les sujets et
          les créneaux UTC que tu choisis ici. Il n’utilise ni réponses d’affinité, ni messages
          privés, ni localisation précise, ni donnée sensible.
        </p>
      </header>

      {message ? <p role="status" style={{ color: 'var(--orange)' }}>{message}</p> : null}

      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <h2>Consentement</h2>
        {preference ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <label>
              <input
                type="checkbox"
                checked={preference.matchmakingEnabled}
                onChange={(event) =>
                  updatePreference({ matchmakingEnabled: event.target.checked })
                }
                disabled={busy}
              />{' '}
              Activer volontairement le matchmaking social
            </label>
            <label>
              <input
                type="checkbox"
                checked={preference.allowNewPeople}
                onChange={(event) =>
                  updatePreference({ allowNewPeople: event.target.checked })
                }
                disabled={busy}
              />{' '}
              Autoriser une proposition avec une nouvelle personne
            </label>
          </div>
        ) : null}
      </section>

      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <h2>Mes critères explicites</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ flex: 1 }}>
              Objectif
              <select className="input" value={purpose} onChange={(event) => setPurpose(event.target.value)} style={{ width: '100%' }}>
                <option value="CHAT">Discuter</option>
                <option value="PLAY">Jouer</option>
                <option value="LEARN">Apprendre</option>
                <option value="CREATE">Créer</option>
              </select>
            </label>
            <label style={{ flex: 1 }}>
              Rythme
              <select className="input" value={pace} onChange={(event) => setPace(event.target.value)} style={{ width: '100%' }}>
                <option value="REALTIME">Temps réel</option>
                <option value="ASYNC">Asynchrone</option>
                <option value="FLEXIBLE">Flexible</option>
              </select>
            </label>
          </div>

          <label>
            Langues, séparées par une virgule
            <input className="input" value={languages} onChange={(event) => setLanguages(event.target.value)} maxLength={60} style={{ width: '100%' }} />
          </label>

          <div>
            <strong>Sujets publics choisis</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={topics.includes(topic) ? 'btn btn-primary' : 'btn'}
                  onClick={() => toggleTopic(topic)}
                  disabled={busy}
                >
                  {topic.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <label>
              Jour UTC
              <select className="input" value={dayOfWeek} onChange={(event) => setDayOfWeek(Number(event.target.value))} style={{ width: '100%' }}>
                {['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </label>
            <label>
              Début UTC
              <input className="input" type="number" min={0} max={1439} value={startMinute} onChange={(event) => setStartMinute(Number(event.target.value))} style={{ width: '100%' }} />
              <small>{minutesLabel(startMinute)}</small>
            </label>
            <label>
              Fin UTC
              <input className="input" type="number" min={1} max={1440} value={endMinute} onChange={(event) => setEndMinute(Number(event.target.value))} style={{ width: '100%' }} />
              <small>{minutesLabel(endMinute)}</small>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={join} disabled={busy || !canJoin}>
              Rejoindre ou actualiser la file
            </button>
            <button className="btn" onClick={leave} disabled={busy || !status?.queue || !['QUEUED', 'MATCHED'].includes(status.queue.status)}>
              Quitter immédiatement
            </button>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <h2>État</h2>
        <p>
          File : <strong>{status?.queue?.status ?? 'ABSENT'}</strong>
          {status?.queue ? ` · ${status.queue.purpose} · ${status.queue.pace}` : ''}
        </p>
        {status?.proposal ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <h3>{status.proposal.partner?.displayName ?? 'Compte supprimé'}</h3>
              {status.proposal.partner ? <p style={{ color: 'var(--muted)' }}>@{status.proposal.partner.username}</p> : null}
              <strong>Score explicatif : {status.proposal.score}/100</strong>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {status.proposal.explanation.explanations.map((explanation) => (
                <p key={explanation} style={{ margin: 0 }}>{explanation}</p>
              ))}
            </div>
            <p style={{ color: 'var(--muted)' }}>
              Données sensibles utilisées : non · réponses d’affinité : non · messages privés : non · localisation précise : non
            </p>
            {status.proposal.status === 'PENDING' && !status.proposal.yourDecision ? (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => decide('ACCEPT')} disabled={busy}>Accepter</button>
                <button className="btn" onClick={() => decide('DECLINE')} disabled={busy}>Refuser</button>
                <button className="btn" onClick={() => decide('BLOCK')} disabled={busy}>Bloquer</button>
              </div>
            ) : null}
            {status.proposal.yourDecision ? <p>Ta réponse : {status.proposal.yourDecision}</p> : null}
            {status.proposal.status === 'ACCEPTED' ? (
              <p style={{ color: 'var(--mint)', fontWeight: 800 }}>
                Acceptation mutuelle confirmée. Vous pouvez maintenant choisir librement de vous contacter.
              </p>
            ) : null}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)' }}>Aucune proposition active.</p>
        )}
      </section>

      <section className="card" style={{ padding: 22 }}>
        <h2>Personnes bloquées</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {blocks.map((block) => (
            <div key={block.blockedId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <span>{block.user?.displayName ?? 'Compte indisponible'}</span>
              <button className="btn" onClick={() => unblock(block.blockedId)} disabled={busy}>Débloquer</button>
            </div>
          ))}
          {!blocks.length ? <p style={{ color: 'var(--muted)' }}>Aucun blocage.</p> : null}
        </div>
      </section>
    </main>
  );
}

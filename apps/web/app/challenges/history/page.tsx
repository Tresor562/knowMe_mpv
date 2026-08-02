'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type HistoryItem = {
  id: string;
  challengeId: string;
  participantId: string;
  challengeVersion: number;
  status: 'PENDING_REFERENCE' | 'SCORED';
  score: number;
  correctCount: number;
  questionCount: number;
  completedAt: string;
  scoredAt?: string | null;
  challenge?: {
    title: string;
    description?: string | null;
    visibility: string;
    creator: {
      displayName: string;
      username: string;
    };
  } | null;
};

type FeedbackItem = {
  questionId: string;
  position: number;
  prompt: string;
  answer: string;
  expectedAnswer: string;
  correct: boolean;
};

type ResultDetail = HistoryItem & {
  userId: string;
  feedback?: FeedbackItem[] | null;
};

export default function ChallengeHistoryPage() {
  const { loading: sessionLoading } = useSession({ required: true });
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<ResultDetail | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const history = await apiFetch<{ items: HistoryItem[] }>('/challenges/history');
      setItems(history.items);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Historique indisponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function openResult(item: HistoryItem) {
    try {
      const result = await apiFetch<ResultDetail>(
        `/challenges/${item.challengeId}/results/${item.participantId}`
      );
      setSelected({ ...item, ...result });
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Résultat indisponible.');
    }
  }

  if (sessionLoading) {
    return <main className="shell"><p>Chargement de l’historique…</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 960, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <small style={{ color: 'var(--orange)' }}>DÉFIS V2</small>
          <h1>Mon historique immuable</h1>
          <p style={{ color: 'var(--muted)' }}>
            Chaque résultat reste rattaché à la version réellement jouée.
          </p>
        </div>
        <Link className="btn" href="/challenges">Retour aux défis</Link>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}
      {loading && <p>Chargement…</p>}

      {!loading && items.length === 0 && (
        <section className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🗂️</div>
          <h2>Aucune partie terminée</h2>
          <p style={{ color: 'var(--muted)' }}>
            Termine un défi pour créer ton premier résultat archivé.
          </p>
        </section>
      )}

      <section className="grid" style={{ marginTop: 20 }}>
        {items.map((item) => (
          <article className="card" key={item.id} style={{ padding: 20 }}>
            <small style={{ color: 'var(--mint)' }}>VERSION {item.challengeVersion}</small>
            <h2>{item.challenge?.title ?? 'Défi supprimé'}</h2>
            {item.challenge && (
              <p style={{ color: 'var(--muted)' }}>
                Créé par {item.challenge.creator.displayName} (@{item.challenge.creator.username})
              </p>
            )}
            {item.status === 'SCORED' ? (
              <p>
                <strong>{item.score}%</strong> · {item.correctCount}/{item.questionCount} réponse(s) correspondante(s)
              </p>
            ) : (
              <p style={{ color: 'var(--orange)' }}>
                Résultat enregistré. Le score apparaîtra lorsque le créateur aura verrouillé le corrigé.
              </p>
            )}
            <p style={{ color: 'var(--muted)' }}>
              Terminé le {new Date(item.completedAt).toLocaleString('fr-FR')}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => void openResult(item)}>
                Voir le feedback
              </button>
              <Link className="btn" href={`/challenges/${item.challengeId}`}>Ouvrir le défi</Link>
            </div>
          </article>
        ))}
      </section>

      {selected && (
        <section className="card" style={{ padding: 24, marginTop: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <small style={{ color: 'var(--orange)' }}>FEEDBACK SERVEUR</small>
              <h2>{selected.challenge?.title ?? 'Résultat du défi'}</h2>
            </div>
            <button className="btn" onClick={() => setSelected(null)}>Fermer</button>
          </div>

          {selected.status === 'PENDING_REFERENCE' || !selected.feedback ? (
            <p style={{ color: 'var(--muted)' }}>
              Tes réponses sont archivées. Le corrigé de cette version n’est pas encore disponible.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 22 }}>
                Score : <strong>{selected.score}%</strong> — {selected.correctCount}/{selected.questionCount}
              </p>
              <div className="grid">
                {selected.feedback.map((feedback, index) => (
                  <article className="card" key={feedback.questionId} style={{ padding: 18 }}>
                    <strong>{index + 1}. {feedback.prompt}</strong>
                    <p>Ta réponse : {feedback.answer}</p>
                    <p>Réponse de référence : {feedback.expectedAnswer}</p>
                    <small style={{ color: feedback.correct ? 'var(--mint)' : 'var(--orange)' }}>
                      {feedback.correct ? 'Correspondance' : 'Différence'}
                    </small>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}

'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Question = { id: string; prompt: string; position: number };
type Answer = { id: string; questionId: string; value: string };
type Participant = {
  id: string;
  userId: string;
  completedAt?: string | null;
  user: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  answers: Answer[];
};
type Challenge = {
  id: string;
  title: string;
  description?: string | null;
  status: 'ACTIVE' | 'COMPLETED';
  creatorId: string;
  createdAt: string;
  creator: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  questions: Question[];
  participants: Participant[];
};

export default function ChallengeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setChallenge(await apiFetch<Challenge>(`/challenges/${id}`));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Défi introuvable.');
    }
  }, [id]);

  useEffect(() => {
    if (!sessionLoading) load();
  }, [load, sessionLoading]);

  const myParticipation = useMemo(
    () => challenge?.participants.find((participant) => participant.userId === user?.id),
    [challenge, user?.id]
  );

  async function submitAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    const data = new FormData(event.currentTarget);
    const answers = challenge.questions.map((question) => ({
      questionId: question.id,
      value: String(data.get(question.id) ?? '').trim()
    }));
    if (answers.some((answer) => !answer.value)) {
      setMessage('Réponds à toutes les questions avant de valider.');
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/challenges/${challenge.id}/answers`, {
        method: 'POST',
        body: JSON.stringify({ answers })
      });
      setMessage('Tes réponses ont été enregistrées.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function completeChallenge() {
    if (!challenge || !window.confirm('Terminer ce défi ? Les nouvelles réponses seront bloquées.')) return;
    try {
      await apiFetch(`/challenges/${challenge.id}/complete`, { method: 'PATCH' });
      setMessage('Le défi est terminé.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Clôture impossible.');
    }
  }

  if (sessionLoading || !challenge) {
    return <main className="shell"><p>{message || 'Chargement du défi…'}</p></main>;
  }

  const isCreator = challenge.creatorId === user?.id;

  return (
    <main className="shell" style={{maxWidth:900,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div>
          <small style={{color:'var(--orange)'}}>DÉFI KNOWME</small>
          <h1>{challenge.title}</h1>
          <p style={{color:'var(--muted)'}}>Créé par {challenge.creator.displayName} (@{challenge.creator.username})</p>
        </div>
        <Link href="/challenges" className="btn">Retour aux défis</Link>
      </header>

      {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}

      <section className="card" style={{padding:22,marginBottom:20}}>
        {challenge.description && <p style={{fontSize:18,lineHeight:1.6}}>{challenge.description}</p>}
        <div style={{display:'flex',gap:16,flexWrap:'wrap',color:'var(--muted)'}}>
          <span>{challenge.questions.length} question(s)</span>
          <span>{challenge.participants.length} participant(s)</span>
          <span>Statut : {challenge.status}</span>
        </div>
        {isCreator && challenge.status === 'ACTIVE' && (
          <button className="btn btn-accent" onClick={completeChallenge} style={{marginTop:16}}>Terminer le défi</button>
        )}
      </section>

      {challenge.status === 'ACTIVE' && myParticipation && (
        <form className="card grid" onSubmit={submitAnswers} style={{padding:22}}>
          <h2>{myParticipation.completedAt ? 'Modifier mes réponses' : 'Répondre au défi'}</h2>
          {challenge.questions.map((question, index) => {
            const current = myParticipation.answers.find((answer) => answer.questionId === question.id)?.value ?? '';
            return (
              <label key={question.id} style={{display:'grid',gap:8}}>
                <strong>{index + 1}. {question.prompt}</strong>
                <textarea className="input" name={question.id} defaultValue={current} rows={3} maxLength={1000} required />
              </label>
            );
          })}
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer mes réponses'}</button>
        </form>
      )}

      <section style={{marginTop:28}}>
        <h2>Participants</h2>
        <div className="grid">
          {challenge.participants.map((participant) => (
            <article className="card" key={participant.id} style={{padding:18,display:'flex',justifyContent:'space-between',gap:16,alignItems:'center'}}>
              <div>
                <strong>{participant.user.displayName}</strong>
                <div style={{color:'var(--muted)'}}>@{participant.user.username}</div>
              </div>
              <small style={{color:participant.completedAt ? 'var(--mint)' : 'var(--muted)'}}>
                {participant.completedAt ? 'Réponses terminées' : 'En cours'}
              </small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

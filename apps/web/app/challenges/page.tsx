'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Challenge = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  questions: Array<{ id: string; prompt: string }>;
  participants: Array<{ id: string; userId?: string }>;
};

export default function ChallengesPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);

  const load = useCallback(async () => {
    try {
      setChallenges(await apiFetch<Challenge[]>('/challenges'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Défis indisponibles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const questions = String(data.get('questions') ?? '')
      .split('\n')
      .map((question) => question.trim())
      .filter(Boolean);

    try {
      await apiFetch('/challenges', {
        method: 'POST',
        body: JSON.stringify({
          title: String(data.get('title') ?? '').trim(),
          description: String(data.get('description') ?? '').trim(),
          questions
        })
      });
      form.reset();
      setShowCreator(false);
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Création impossible.');
    }
  }

  async function join(id: string) {
    try {
      await apiFetch(`/challenges/${id}/join`, { method: 'POST' });
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Participation impossible.');
    }
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement des défis...</p></main>;
  }

  return (
    <main className="shell" style={{maxWidth:900,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div>
          <small style={{color:'var(--orange)'}}>LE CŒUR DE KNOWME</small>
          <h1>Défis de {user.displayName}</h1>
        </div>
        <button className="btn btn-accent" onClick={() => setShowCreator((value) => !value)}>
          {showCreator ? 'Fermer' : '+ Créer un défi'}
        </button>
      </header>

      {showCreator && (
        <form className="card grid" onSubmit={createChallenge} style={{padding:22,marginBottom:20}}>
          <h2>Nouveau défi</h2>
          <input className="input" name="title" placeholder="Titre du défi" minLength={3} required />
          <textarea className="input" name="description" placeholder="Description" rows={3} />
          <textarea className="input" name="questions" placeholder={'Une question par ligne\nQuel est mon plus grand rêve ?\nQuel sujet me passionne ?'} rows={7} required />
          <button className="btn btn-primary">Créer et inviter mes proches</button>
        </form>
      )}

      {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}
      {loading && <p>Chargement...</p>}

      <section className="grid">
        {!loading && challenges.length === 0 && (
          <article className="card" style={{padding:28,textAlign:'center'}}>
            <div style={{fontSize:52}}>🧠</div>
            <h2>Aucun défi pour le moment</h2>
            <p style={{color:'var(--muted)'}}>Crée le premier défi pour commencer à mieux connaître tes proches.</p>
          </article>
        )}

        {challenges.map((challenge) => (
          <article className="card" key={challenge.id} style={{padding:22,display:'grid',gridTemplateColumns:'64px 1fr auto',gap:18,alignItems:'center'}}>
            <div style={{fontSize:42}}>🎯</div>
            <div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <h2 style={{margin:0}}>{challenge.title}</h2>
                <small style={{color:challenge.status === 'ACTIVE' ? 'var(--mint)' : 'var(--muted)'}}>{challenge.status}</small>
              </div>
              {challenge.description && <p>{challenge.description}</p>}
              <p style={{color:'var(--muted)'}}>{challenge.participants.length} participant(s) · {challenge.questions.length} question(s)</p>
            </div>
            {challenge.status === 'ACTIVE' && (
              <button className="btn" onClick={() => join(challenge.id)}>Participer</button>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

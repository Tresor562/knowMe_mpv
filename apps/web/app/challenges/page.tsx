'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
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

type SuggestedChallenge = {
  title: string;
  description: string;
  questions: string[];
};

export default function ChallengesPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedChallenge[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [authorityFresh, setAuthorityFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftQuestions, setDraftQuestions] = useState('');
  const loadGeneration = useRef(0);

  const clearDraft = useCallback(() => {
    setDraftTitle('');
    setDraftDescription('');
    setDraftQuestions('');
  }, []);

  const invalidateAuthority = useCallback(() => {
    loadGeneration.current += 1;
    setAuthorityFresh(false);
    setChallenges([]);
    setSuggestions([]);
    setShowCreator(false);
  }, []);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setAuthorityFresh(false);
    setChallenges([]);
    setSuggestions([]);
    setMessage('');

    try {
      const [incoming, suggested] = await Promise.all([
        apiFetch<Challenge[]>('/challenges'),
        apiFetch<SuggestedChallenge[]>('/intelligence/suggested-challenges').catch(() => [])
      ]);
      if (generation !== loadGeneration.current) return;
      setChallenges(incoming);
      setSuggestions(suggested);
      setAuthorityFresh(true);
    } catch (cause) {
      if (generation !== loadGeneration.current) return;
      setChallenges([]);
      setSuggestions([]);
      setAuthorityFresh(false);
      setMessage(cause instanceof Error ? cause.message : 'Défis indisponibles.');
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    invalidateAuthority();
    clearDraft();
    setLoading(true);
    if (!sessionLoading && user) void load();
    return () => {
      loadGeneration.current += 1;
    };
  }, [clearDraft, invalidateAuthority, load, sessionLoading, user?.id]);

  function useSuggestion(suggestion: SuggestedChallenge) {
    if (!authorityFresh || busy) return;
    setDraftTitle(suggestion.title);
    setDraftDescription(suggestion.description);
    setDraftQuestions(suggestion.questions.join('\n'));
    setShowCreator(true);
    setMessage('Modèle chargé. Tu peux tout modifier avant de créer le défi.');
  }

  async function createChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorityFresh || busy) {
      setMessage('Recharge les défis avant de créer un nouveau défi.');
      return;
    }

    const title = draftTitle.trim();
    const description = draftDescription.trim();
    const questions = draftQuestions
      .split('\n')
      .map((question) => question.trim())
      .filter(Boolean);

    if (title.length < 3 || questions.length === 0) {
      setMessage('Ajoute un titre et au moins une question.');
      return;
    }

    setBusy(true);
    try {
      const created = await apiFetch<Challenge>('/challenges', {
        method: 'POST',
        body: JSON.stringify({ title, description, questions })
      });
      clearDraft();
      setShowCreator(false);
      window.location.href = `/challenges/${created.id}`;
    } catch (cause) {
      invalidateAuthority();
      setMessage(cause instanceof Error ? cause.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function join(id: string) {
    if (!authorityFresh || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/challenges/${id}/join`, { method: 'POST' });
      window.location.href = `/challenges/${id}`;
    } catch (cause) {
      invalidateAuthority();
      setMessage(cause instanceof Error ? cause.message : 'Participation impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || !user) return <main className="shell"><p>Chargement des défis...</p></main>;

  return (
    <main className="shell" style={{maxWidth:900,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div><small style={{color:'var(--orange)'}}>LE CŒUR DE KNOWME</small><h1>Défis de {user.displayName}</h1></div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <Link className="btn" href="/progression">Mon niveau</Link>
          <Link className="btn" href="/challenges/history">Mon historique</Link>
          <button
            className="btn btn-accent"
            disabled={!authorityFresh || busy}
            onClick={() => {
              setShowCreator((value) => !value);
              if (showCreator) clearDraft();
            }}
          >
            {showCreator ? 'Fermer' : '+ Créer un défi'}
          </button>
        </div>
      </header>

      {authorityFresh && suggestions.length > 0 && (
        <section className="card" style={{padding:20,marginBottom:20}} aria-labelledby="challenge-suggestions-title">
          <div style={{marginBottom:14}}>
            <small style={{color:'var(--mint)',fontWeight:800}}>CREATE · DÉMARRER VITE</small>
            <h2 id="challenge-suggestions-title" style={{marginBottom:6}}>Des idées prêtes à personnaliser</h2>
            <p style={{color:'var(--muted)',margin:0}}>
              Choisis un modèle : le titre, la description et trois questions sont préremplis, mais rien n’est publié tant que tu n’as pas validé.
            </p>
          </div>
          <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
            {suggestions.map((suggestion) => (
              <article className="card" key={suggestion.title} style={{padding:16,display:'grid',gap:10}}>
                <div>
                  <strong>{suggestion.title}</strong>
                  <p style={{color:'var(--muted)',marginBottom:0}}>{suggestion.description}</p>
                </div>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => useSuggestion(suggestion)}
                >
                  Utiliser ce modèle
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {showCreator && authorityFresh && (
        <form className="card grid" onSubmit={createChallenge} style={{padding:22,marginBottom:20}}>
          <div>
            <small style={{color:'var(--mint)',fontWeight:800}}>BROUILLON MODIFIABLE</small>
            <h2>Nouveau défi</h2>
          </div>
          <input
            className="input"
            name="title"
            aria-label="Titre du défi"
            placeholder="Titre du défi"
            minLength={3}
            required
            disabled={busy}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
          />
          <textarea
            className="input"
            name="description"
            aria-label="Description du défi"
            placeholder="Description"
            rows={3}
            disabled={busy}
            value={draftDescription}
            onChange={(event) => setDraftDescription(event.target.value)}
          />
          <textarea
            className="input"
            name="questions"
            aria-label="Questions du défi"
            placeholder={'Une question par ligne\nQuel est mon plus grand rêve ?\nQuel sujet me passionne ?'}
            rows={7}
            required
            disabled={busy}
            value={draftQuestions}
            onChange={(event) => setDraftQuestions(event.target.value)}
          />
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button className="btn btn-primary" disabled={busy}>Créer le défi</button>
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={clearDraft}
            >
              Effacer le brouillon
            </button>
          </div>
        </form>
      )}

      {!authorityFresh && !message && <p style={{color:'var(--muted)'}}>Validation des défis…</p>}
      {message && <p role="status" style={{color:'var(--orange)'}}>{message}</p>}
      {loading && <p>Chargement...</p>}

      <section className="grid">
        {authorityFresh && !loading && challenges.length === 0 && (
          <article className="card" style={{padding:28,textAlign:'center'}}><div style={{fontSize:52}}>🧠</div><h2>Aucun défi pour le moment</h2><p style={{color:'var(--muted)'}}>Crée le premier défi pour commencer à mieux connaître tes proches.</p></article>
        )}

        {authorityFresh && challenges.map((challenge) => (
          <article className="card" key={challenge.id} style={{padding:22,display:'grid',gridTemplateColumns:'64px 1fr auto',gap:18,alignItems:'center'}}>
            <div style={{fontSize:42}}>🎯</div>
            <div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><h2 style={{margin:0}}>{challenge.title}</h2><small style={{color:challenge.status === 'ACTIVE' ? 'var(--mint)' : 'var(--muted)'}}>{challenge.status}</small></div>
              {challenge.description && <p>{challenge.description}</p>}
              <p style={{color:'var(--muted)'}}>{challenge.participants.length} participant(s) · {challenge.questions.length} question(s)</p>
            </div>
            <div style={{display:'grid',gap:8}}>
              <Link className="btn" href={`/challenges/${challenge.id}`}>Ouvrir</Link>
              {challenge.status === 'ACTIVE' && !challenge.participants.some((participant) => participant.userId === user.id) && (
                <button className="btn btn-accent" disabled={!authorityFresh || busy} onClick={() => void join(challenge.id)}>Participer</button>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

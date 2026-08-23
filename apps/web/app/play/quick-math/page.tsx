'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  clearGuestSession,
  clearQuickMathSessionId,
  createGuestIdentity,
  createQuickMathSession,
  getGuestToken,
  getSavedQuickMathSessionId,
  GuestAgeGateState,
  GuestQuickMathSession,
  resumeGuestIdentity,
  resumeQuickMathSession,
  submitQuickMathAction
} from '../../../lib/guest-play';

type GuestStatus = 'checking' | 'none' | 'active';

export default function QuickMathInstantPage() {
  const [guestStatus, setGuestStatus] = useState<GuestStatus>('checking');
  const [alias, setAlias] = useState('');
  const [ageGateState, setAgeGateState] = useState<GuestAgeGateState | ''>('');
  const [consent, setConsent] = useState(false);
  const [session, setSession] = useState<GuestQuickMathSession | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!getGuestToken()) {
        if (!cancelled) setGuestStatus('none');
        return;
      }

      try {
        await resumeGuestIdentity();
        if (cancelled) return;
        setGuestStatus('active');

        const savedSessionId = getSavedQuickMathSessionId();
        if (!savedSessionId) return;
        try {
          const restored = await resumeQuickMathSession(savedSessionId);
          if (!cancelled) setSession(restored);
        } catch {
          clearQuickMathSessionId();
        }
      } catch {
        clearGuestSession();
        if (!cancelled) setGuestStatus('none');
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  async function beginGuestPlay() {
    setMessage('');
    setBusy(true);
    try {
      if (guestStatus !== 'active') {
        if (!ageGateState || !consent) {
          setMessage('Choisis ta catégorie d’âge et confirme la création de la session invitée.');
          return;
        }
        await createGuestIdentity({
          ...(alias.trim() ? { publicAlias: alias } : {}),
          ageGateState
        });
        setGuestStatus('active');
      }
      setSession(await createQuickMathSession());
      setAnswer('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible de démarrer la partie.');
    } finally {
      setBusy(false);
    }
  }

  async function startRound() {
    if (!session) return;
    setBusy(true);
    setMessage('');
    try {
      setSession(await submitQuickMathAction(session, 'START', {}));
      setAnswer('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible de commencer la partie.');
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(event: FormEvent) {
    event.preventDefault();
    if (!session || session.state.phase !== 'ACTIVE') return;
    const value = Number(answer);
    if (!Number.isInteger(value)) {
      setMessage('Entre un nombre entier.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      setSession(await submitQuickMathAction(session, 'ANSWER', { answer: value }));
      setAnswer('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible d’envoyer cette réponse.');
    } finally {
      setBusy(false);
    }
  }

  const question = session?.state.question;
  const previous = session?.state.lastOutcome;
  const completed = session?.status === 'COMPLETED' || session?.state.phase === 'COMPLETED';

  return (
    <main className="shell" style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 48 }}>
      <header style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        <Link href="/games/center" style={{ color: 'var(--muted)' }}>← Game Center</Link>
        <small style={{ color: 'var(--mint)', fontWeight: 800 }}>INSTANT · SOLO · BRAIN</small>
        <h1 style={{ margin: 0 }}>Quick Math</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
          Cinq calculs rapides. Aucun compte n’est nécessaire et le score est calculé par le serveur.
        </p>
      </header>

      {message ? (
        <p role="status" aria-live="polite" className="card" style={{ padding: 12, color: 'var(--orange)' }}>
          {message}
        </p>
      ) : null}

      {guestStatus === 'checking' ? (
        <section className="card" aria-busy="true" style={{ padding: 20 }}>
          <p style={{ margin: 0 }}>Recherche d’une partie invitée à reprendre…</p>
        </section>
      ) : null}

      {guestStatus !== 'checking' && !session ? (
        <section className="card" style={{ padding: 22, display: 'grid', gap: 16 }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Jouer maintenant</h2>
            <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
              Une identité invitée temporaire suffit. Elle ne demande ni ton nom réel, ni tes contacts.
            </p>
          </div>

          {guestStatus === 'none' ? (
            <>
              <label style={{ display: 'grid', gap: 6 }}>
                Pseudo temporaire <small style={{ color: 'var(--muted)' }}>(facultatif)</small>
                <input
                  className="input"
                  value={alias}
                  maxLength={30}
                  autoComplete="off"
                  onChange={(event) => setAlias(event.target.value)}
                  placeholder="Ex. Player42"
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                Catégorie d’âge
                <select
                  className="input"
                  value={ageGateState}
                  onChange={(event) => setAgeGateState(event.target.value as GuestAgeGateState | '')}
                >
                  <option value="">Choisir</option>
                  <option value="ADULT">18 ans ou plus</option>
                  <option value="MINOR_ALLOWED">Moins de 18 ans et autorisé à utiliser KnowMe</option>
                </select>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, lineHeight: 1.5 }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  J’accepte la création d’une session invitée temporaire pour jouer. Les données de jeu invitées
                  ne sont pas annoncées comme transférées vers un futur compte.
                </span>
              </label>
            </>
          ) : (
            <p style={{ margin: 0, color: 'var(--mint)' }}>Session invitée active sur cet appareil.</p>
          )}

          <button className="btn btn-primary" disabled={busy} onClick={() => void beginGuestPlay()}>
            {busy ? 'Démarrage…' : 'Jouer sans compte'}
          </button>
        </section>
      ) : null}

      {session && !completed ? (
        <section className="card" style={{ padding: 22, display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <strong>Score : {session.state.score}/{session.state.maxRounds}</strong>
            <span style={{ color: 'var(--muted)' }}>
              {session.state.phase === 'READY'
                ? `${session.state.maxRounds} questions`
                : `Question ${session.state.round}/${session.state.maxRounds}`}
            </span>
          </div>

          {previous ? (
            <p role="status" aria-live="polite" style={{ margin: 0, color: previous.correct ? 'var(--mint)' : 'var(--orange)' }}>
              {previous.correct
                ? `Bonne réponse : ${previous.correctAnswer}`
                : `Réponse attendue : ${previous.correctAnswer}`}
            </p>
          ) : null}

          {session.state.phase === 'READY' ? (
            <button className="btn btn-primary" disabled={busy} onClick={() => void startRound()}>
              {busy ? 'Préparation…' : 'Commencer les 5 questions'}
            </button>
          ) : null}

          {session.state.phase === 'ACTIVE' && question ? (
            <form onSubmit={submitAnswer} style={{ display: 'grid', gap: 14 }}>
              <div aria-label="Calcul actuel" style={{ textAlign: 'center', fontSize: 'clamp(2rem, 10vw, 4rem)', fontWeight: 900 }}>
                {question.left} {question.operator} {question.right} = ?
              </div>
              <label style={{ display: 'grid', gap: 6 }}>
                Ta réponse
                <input
                  className="input"
                  inputMode="numeric"
                  pattern="-?[0-9]+"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  autoFocus
                  aria-describedby="quick-math-progress"
                />
              </label>
              <small id="quick-math-progress" style={{ color: 'var(--muted)' }}>
                Le navigateur n’envoie que ta réponse ; le calcul du score reste côté serveur.
              </small>
              <button className="btn btn-primary" disabled={busy || answer.trim() === ''} type="submit">
                {busy ? 'Validation…' : 'Valider'}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {session && completed ? (
        <section className="card" style={{ padding: 22, display: 'grid', gap: 16, textAlign: 'center' }}>
          <small style={{ color: 'var(--mint)', fontWeight: 800 }}>PARTIE TERMINÉE</small>
          <h2 style={{ margin: 0 }}>Score : {session.result?.score ?? session.state.score}/{session.state.maxRounds}</h2>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            Tu peux rejouer immédiatement. Un compte n’est nécessaire que lorsque tu veux conserver les fonctions qui le nécessitent.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => void beginGuestPlay()}>
              Rejouer
            </button>
            <Link className="btn" href="/register">Créer un compte</Link>
            <Link className="btn" href="/games/center">Découvrir d’autres jeux</Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}

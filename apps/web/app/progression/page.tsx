'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type ProgressionProfile = {
  totalXp: number;
  level: number;
  currentLevelStartXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
  updatedAt: string;
};

type XpEntry = {
  id: string;
  amount: number;
  source: string;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
};

type ProgressionSummary = {
  profile: ProgressionProfile;
  items: XpEntry[];
  nextCursor?: string | null;
  rules: {
    challengeCompletionXp: number;
    minimumChallengeQuestions: number;
    levelFormula: string;
  };
};

export default function ProgressionPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [summary, setSummary] = useState<ProgressionSummary | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setSummary(await apiFetch<ProgressionSummary>('/progression/me?limit=50'));
      setMessage('');
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Progression indisponible.'
      );
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  if (sessionLoading || !user || !summary) {
    return (
      <main className="shell">
        <p>{message || 'Chargement de ta progression…'}</p>
      </main>
    );
  }

  const { profile, rules } = summary;

  return (
    <main className="shell" style={{ maxWidth: 920, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div>
          <small style={{ color: 'var(--mint)' }}>PROGRESSION KNOWME</small>
          <h1>Niveau {profile.level} de {user.displayName}</h1>
          <p style={{ color: 'var(--muted)' }}>
            Ton niveau est calculé exclusivement depuis le registre XP du serveur.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/challenges/history" className="btn">
            Parties terminées
          </Link>
          <Link href="/challenges" className="btn btn-primary">
            Jouer un défi
          </Link>
        </div>
      </header>

      {message && (
        <p role="alert" style={{ color: 'var(--orange)' }}>
          {message}
        </p>
      )}

      <section
        className="card"
        style={{ padding: 24, marginTop: 20, marginBottom: 20 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'end',
            gap: 16,
            flexWrap: 'wrap'
          }}
        >
          <div>
            <small style={{ color: 'var(--muted)' }}>XP TOTAL</small>
            <div style={{ fontSize: 48, fontWeight: 900 }}>{profile.totalXp}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>{profile.xpToNextLevel} XP avant le niveau {profile.level + 1}</strong>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>
              Seuil suivant : {profile.nextLevelXp} XP
            </div>
          </div>
        </div>

        <div
          aria-label={`Progression du niveau ${profile.level}`}
          style={{
            height: 16,
            borderRadius: 999,
            background: 'var(--surface-2)',
            overflow: 'hidden',
            marginTop: 18
          }}
        >
          <div
            style={{
              width: `${profile.progressPercent}%`,
              minWidth: profile.progressPercent > 0 ? 8 : 0,
              height: '100%',
              borderRadius: 999,
              background: 'var(--mint)'
            }}
          />
        </div>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          {profile.xpIntoLevel} XP gagnés dans ce niveau · {profile.progressPercent}%
        </p>
      </section>

      <section className="card" style={{ padding: 20, marginBottom: 24 }}>
        <small style={{ color: 'var(--orange)' }}>RÈGLES ACTUELLES</small>
        <h2>Une progression saine et vérifiable</h2>
        <p style={{ color: 'var(--muted)' }}>
          Un défi éligible rapporte {rules.challengeCompletionXp} XP lors de sa première
          complétion. Il doit contenir au moins {rules.minimumChallengeQuestions} questions,
          et le créateur ne gagne pas d’XP sur son propre défi.
        </p>
        <code>{rules.levelFormula}</code>
      </section>

      <section>
        <h2>Journal XP</h2>
        <div className="grid">
          {summary.items.map((entry) => (
            <article className="card" key={entry.id} style={{ padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}
              >
                <strong>+{entry.amount} XP</strong>
                <small style={{ color: 'var(--muted)' }}>
                  {new Date(entry.createdAt).toLocaleString('fr-FR')}
                </small>
              </div>
              <p>{entry.reason}</p>
              <small style={{ color: 'var(--muted)' }}>
                {entry.source}
                {entry.referenceType ? ` · ${entry.referenceType}` : ''}
              </small>
            </article>
          ))}
          {!summary.items.length && (
            <article className="card" style={{ padding: 26, textAlign: 'center' }}>
              <div style={{ fontSize: 44 }}>🌱</div>
              <h2>Ton aventure commence ici</h2>
              <p style={{ color: 'var(--muted)' }}>
                Termine un défi éligible pour obtenir ta première écriture XP.
              </p>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

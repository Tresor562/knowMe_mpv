'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type StreakSummary = {
  profile: {
    currentDays: number;
    longestDays: number;
    lastActivityDate: string | null;
    status: 'NOT_STARTED' | 'ACTIVE_TODAY' | 'GRACE_WINDOW' | 'INACTIVE';
  };
  days: Array<{
    id: string;
    activityDate: string;
    source: string;
  }>;
  rules: {
    timezone: string;
    oneCreditPerDay: boolean;
    allowedMissedDays: number;
    minimumChallengeQuestions: number;
    purchasesAffectStreak: boolean;
    explanation: string;
  };
};

const statusLabels: Record<StreakSummary['profile']['status'], string> = {
  NOT_STARTED: 'Pas encore commencée',
  ACTIVE_TODAY: 'Activité validée aujourd’hui',
  GRACE_WINDOW: 'Fenêtre de respiration active',
  INACTIVE: 'Prête pour un nouveau départ'
};

export default function StreaksPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [summary, setSummary] = useState<StreakSummary | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setSummary(await apiFetch<StreakSummary>('/streaks/me?limit=60'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Série indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  if (sessionLoading || !user || !summary) {
    return (
      <main className="shell">
        <p>{message || 'Chargement de ta série…'}</p>
      </main>
    );
  }

  const { profile, rules } = summary;

  return (
    <main className="shell" style={{ maxWidth: 920, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--mint)' }}>SÉRIE SAINE</small>
          <h1>{profile.currentDays} jour{profile.currentDays === 1 ? '' : 's'} en cours</h1>
          <p style={{ color: 'var(--muted)' }}>{statusLabels[profile.status]}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/progression" className="btn">Voir mon niveau</Link>
          <Link href="/challenges" className="btn btn-primary">Jouer un défi</Link>
        </div>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section className="grid" style={{ marginTop: 20 }}>
        <article className="card" style={{ padding: 24 }}>
          <small style={{ color: 'var(--muted)' }}>RECORD PERSONNEL</small>
          <div style={{ fontSize: 44, fontWeight: 900 }}>{profile.longestDays}</div>
          <p style={{ color: 'var(--muted)' }}>jours d’activité éligible</p>
        </article>
        <article className="card" style={{ padding: 24 }}>
          <small style={{ color: 'var(--muted)' }}>DERNIÈRE ACTIVITÉ</small>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>
            {profile.lastActivityDate
              ? new Date(profile.lastActivityDate).toLocaleDateString('fr-FR')
              : 'Aucune'}
          </div>
          <p style={{ color: 'var(--muted)' }}>Journées calculées en {rules.timezone}</p>
        </article>
      </section>

      <section className="card" style={{ padding: 20, marginTop: 20 }}>
        <small style={{ color: 'var(--orange)' }}>RÈGLES SANS PRESSION</small>
        <h2>La régularité compte, pas la culpabilité</h2>
        <p style={{ color: 'var(--muted)' }}>{rules.explanation}</p>
        <ul>
          <li>Un seul crédit maximum par journée.</li>
          <li>Un jour complet peut être manqué sans casser la continuité.</li>
          <li>Les achats Premium et KnowCoins ne modifient jamais la série.</li>
          <li>Un défi doit avoir au moins {rules.minimumChallengeQuestions} questions.</li>
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Journées validées</h2>
        <div className="grid">
          {summary.days.map((day) => (
            <article className="card" key={day.id} style={{ padding: 18 }}>
              <strong>{new Date(day.activityDate).toLocaleDateString('fr-FR')}</strong>
              <p style={{ color: 'var(--muted)', marginBottom: 0 }}>{day.source}</p>
            </article>
          ))}
          {!summary.days.length && (
            <article className="card" style={{ padding: 28, textAlign: 'center' }}>
              <div style={{ fontSize: 44 }}>🌿</div>
              <h2>Commence à ton rythme</h2>
              <p style={{ color: 'var(--muted)' }}>Termine un défi éligible quand tu es prêt.</p>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

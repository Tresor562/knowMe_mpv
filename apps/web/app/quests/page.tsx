'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type QuestSummary = {
  quest: {
    key: string;
    title: string;
    description: string;
    questDate: string;
    target: number;
    progress: number;
    status: 'IN_PROGRESS' | 'COMPLETED';
    completedAt: string | null;
  };
  rules: {
    timezone: string;
    automaticCompletion: boolean;
    manualClaimRequired: boolean;
    paidBoostsAllowed: boolean;
    reward: null;
    minimumChallengeQuestions: number;
  };
};

export default function QuestsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [summary, setSummary] = useState<QuestSummary | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setSummary(await apiFetch<QuestSummary>('/quests/today'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Quête indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  if (sessionLoading || !user || !summary) {
    return (
      <main className="shell">
        <p>{message || 'Chargement de la quête du jour…'}</p>
      </main>
    );
  }

  const { quest, rules } = summary;
  const percent = Math.min(100, Math.floor((quest.progress / quest.target) * 100));

  return (
    <main className="shell" style={{ maxWidth: 840, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--mint)' }}>QUÊTE DU JOUR</small>
          <h1>{quest.title}</h1>
          <p style={{ color: 'var(--muted)' }}>{quest.description}</p>
        </div>
        <Link href="/challenges" className="btn btn-primary">Voir les défis</Link>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section className="card" style={{ padding: 24, marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <strong>{quest.status === 'COMPLETED' ? 'Terminée automatiquement' : 'En cours'}</strong>
          <span>{quest.progress}/{quest.target}</span>
        </div>
        <div style={{ height: 14, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 16 }}>
          <div style={{ width: `${percent}%`, height: '100%', background: 'var(--mint)' }} />
        </div>
        <p style={{ color: 'var(--muted)' }}>
          Journée {new Date(quest.questDate).toLocaleDateString('fr-FR')} · fuseau {rules.timezone}
        </p>
      </section>

      <section className="card" style={{ padding: 20, marginTop: 20 }}>
        <small style={{ color: 'var(--orange)' }}>RÈGLES TRANSPARENTES</small>
        <h2>Aucune réclamation, aucun achat, aucune pression</h2>
        <ul>
          <li>La complétion est validée automatiquement par le serveur.</li>
          <li>Aucun bouton ne permet de modifier ou réclamer la progression.</li>
          <li>Premium, KnowCoins et boosts payants sont sans effet.</li>
          <li>Le défi doit contenir au moins {rules.minimumChallengeQuestions} questions.</li>
          <li>Cette première quête ne distribue aucune récompense monétaire.</li>
        </ul>
      </section>
    </main>
  );
}

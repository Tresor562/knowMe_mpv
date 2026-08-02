'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type WeeklyLeaderboard = {
  window: { start: string; end: string };
  entries: Array<{
    rank: number;
    alias: string;
    weeklyXp: number;
    rankingXp: number;
    capped: boolean;
    isSelf: boolean;
  }>;
  self: {
    eligible: boolean;
    reasonCode: string;
    rank?: number | null;
    weeklyXp: number;
    rankingXp: number;
  };
  preference: {
    enabled: boolean;
    displayAlias: string | null;
  };
  rules: {
    maximumVisibleEntries: number;
    weeklyRankingXpCap: number;
    rewards: null;
    paidBoostsAllowed: boolean;
    scoreSource: string;
  };
};

export default function LeaderboardsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [data, setData] = useState<WeeklyLeaderboard | null>(null);
  const [alias, setAlias] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await apiFetch<WeeklyLeaderboard>('/leaderboards/weekly');
      setData(next);
      setAlias(next.preference.displayAlias ?? '');
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Classement indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function updatePreference(event: FormEvent, enabled: boolean) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/leaderboards/weekly/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ enabled, displayAlias: alias })
      });
      await load();
      setMessage(
        enabled
          ? 'Participation au classement activée.'
          : 'Tu as été retiré immédiatement du classement.'
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Préférence non enregistrée.');
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || !user || !data) {
    return (
      <main className="shell">
        <p>{message || 'Chargement du classement…'}</p>
      </main>
    );
  }

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
          <small style={{ color: 'var(--mint)' }}>CLASSEMENT SAIN</small>
          <h1>XP de la semaine</h1>
          <p style={{ color: 'var(--muted)' }}>
            Du {new Date(data.window.start).toLocaleDateString('fr-FR')} au{' '}
            {new Date(data.window.end).toLocaleDateString('fr-FR')} · UTC
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/achievements" className="btn">
            Mes mérites
          </Link>
          <Link href="/progression" className="btn btn-primary">
            Progression XP
          </Link>
        </div>
      </header>

      {message && <p role="status">{message}</p>}

      <section className="card" style={{ padding: 22, marginTop: 20 }}>
        <h2>Participation volontaire</h2>
        <p style={{ color: 'var(--muted)' }}>
          Tu n’apparais jamais automatiquement. La découvrabilité de ton profil doit aussi rester
          activée, et tu peux quitter le classement immédiatement.
        </p>
        <form>
          <label style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
            Pseudonyme public
            <input
              value={alias}
              minLength={3}
              maxLength={32}
              onChange={(event) => setAlias(event.target.value)}
              placeholder="Ton nom dans le classement"
            />
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {!data.preference.enabled ? (
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={(event) => void updatePreference(event, true)}
              >
                Rejoindre volontairement
              </button>
            ) : (
              <button
                className="btn"
                disabled={saving}
                onClick={(event) => void updatePreference(event, false)}
              >
                Quitter le classement
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card" style={{ padding: 20, marginTop: 22 }}>
        <h2>Ta position</h2>
        {data.self.eligible ? (
          <p>
            {data.self.rank ? `Rang ${data.self.rank}` : 'Pas encore classé'} ·{' '}
            {data.self.weeklyXp} XP réels · {data.self.rankingXp} XP classants
          </p>
        ) : (
          <p style={{ color: 'var(--muted)' }}>
            {data.self.reasonCode === 'DISCOVERABILITY_DISABLED'
              ? 'Ta découvrabilité est désactivée : tu restes invisible.'
              : 'Active volontairement ta participation pour apparaître.'}
          </p>
        )}
      </section>

      <section style={{ marginTop: 26 }}>
        <h2>Top {data.rules.maximumVisibleEntries}</h2>
        <div className="grid">
          {data.entries.map((entry) => (
            <article className="card" key={`${entry.rank}-${entry.alias}`} style={{ padding: 18 }}>
              <small style={{ color: 'var(--mint)' }}>RANG {entry.rank}</small>
              <h3>
                {entry.alias} {entry.isSelf ? '· toi' : ''}
              </h3>
              <strong>{entry.rankingXp} XP classants</strong>
              <p style={{ color: 'var(--muted)' }}>
                {entry.weeklyXp} XP gagnés cette semaine
                {entry.capped ? ' · plafond sain atteint' : ''}
              </p>
            </article>
          ))}
          {!data.entries.length && (
            <article className="card" style={{ padding: 24 }}>
              <h3>Aucun classement actif</h3>
              <p style={{ color: 'var(--muted)' }}>
                Seuls les comptes volontaires, découvrables et ayant gagné de l’XP apparaissent.
              </p>
            </article>
          )}
        </div>
      </section>

      <section className="card" style={{ padding: 20, marginTop: 26 }}>
        <h2>Limites anti-pression</h2>
        <p style={{ color: 'var(--muted)' }}>
          Le score classant est plafonné à {data.rules.weeklyRankingXpCap} XP par semaine. Le surplus
          reste dans ta progression réelle mais n’encourage pas le farming. Aucun prix, boost payant
          ou avantage compétitif n’est associé au rang.
        </p>
      </section>
    </main>
  );
}

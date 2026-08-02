'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type MeritGrant = {
  id: string;
  grantedAt: string;
  revokedAt?: string | null;
  definition: {
    key: string;
    version: number;
    type: 'BADGE' | 'TITLE';
    name: string;
    description: string;
    icon?: string | null;
  };
};

type AchievementSummary = {
  selectedTitle: MeritGrant | null;
  badges: MeritGrant[];
  titles: MeritGrant[];
  history: MeritGrant[];
  rules: {
    serverAuthoritative: boolean;
    paidMeritAllowed: boolean;
    verificationSeparation: boolean;
    staffSeparation: boolean;
    premiumSeparation: boolean;
  };
};

export default function AchievementsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [summary, setSummary] = useState<AchievementSummary | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setSummary(await apiFetch<AchievementSummary>('/achievements/me'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Mérites indisponibles.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function selectTitle(grantId: string | null) {
    setSaving(true);
    try {
      const next = await apiFetch<AchievementSummary>('/achievements/title', {
        method: 'PATCH',
        body: JSON.stringify({ grantId })
      });
      setSummary(next);
      setMessage(grantId ? 'Titre affiché mis à jour.' : 'Titre affiché retiré.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Sélection impossible.');
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || !user || !summary) {
    return (
      <main className="shell">
        <p>{message || 'Chargement de tes mérites…'}</p>
      </main>
    );
  }

  return (
    <main className="shell" style={{ maxWidth: 980, margin: '0 auto' }}>
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
          <small style={{ color: 'var(--mint)' }}>MÉRITES KNOWME</small>
          <h1>Badges et titres de {user.displayName}</h1>
          <p style={{ color: 'var(--muted)' }}>
            Chaque mérite provient d’un événement vérifié par le serveur.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/quests" className="btn">
            Quête du jour
          </Link>
          <Link href="/progression" className="btn btn-primary">
            Progression XP
          </Link>
        </div>
      </header>

      {message && <p role="status">{message}</p>}

      <section className="card" style={{ padding: 22, marginTop: 20 }}>
        <small style={{ color: 'var(--orange)' }}>TITRE AFFICHÉ</small>
        <h2>
          {summary.selectedTitle
            ? `${summary.selectedTitle.definition.icon ?? '🏷️'} ${summary.selectedTitle.definition.name}`
            : 'Aucun titre sélectionné'}
        </h2>
        <p style={{ color: 'var(--muted)' }}>
          Le titre est cosmétique. Il ne donne aucun privilège et ne remplace jamais les badges
          Vérifié, Premium ou Équipe KnowMe.
        </p>
        {summary.selectedTitle && (
          <button className="btn" disabled={saving} onClick={() => void selectTitle(null)}>
            Retirer le titre
          </button>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Badges obtenus</h2>
        <div className="grid">
          {summary.badges.map((grant) => (
            <article className="card" key={grant.id} style={{ padding: 20 }}>
              <div style={{ fontSize: 40 }}>{grant.definition.icon ?? '🏅'}</div>
              <h3>{grant.definition.name}</h3>
              <p>{grant.definition.description}</p>
              <small style={{ color: 'var(--muted)' }}>
                Version {grant.definition.version} · obtenu le{' '}
                {new Date(grant.grantedAt).toLocaleDateString('fr-FR')}
              </small>
            </article>
          ))}
          {!summary.badges.length && (
            <article className="card" style={{ padding: 24 }}>
              <h3>Aucun badge pour le moment</h3>
              <p style={{ color: 'var(--muted)' }}>
                Termine un défi éligible pour obtenir ton premier mérite.
              </p>
            </article>
          )}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Titres disponibles</h2>
        <div className="grid">
          {summary.titles.map((grant) => {
            const selected = summary.selectedTitle?.id === grant.id;
            return (
              <article className="card" key={grant.id} style={{ padding: 20 }}>
                <div style={{ fontSize: 40 }}>{grant.definition.icon ?? '🏷️'}</div>
                <h3>{grant.definition.name}</h3>
                <p>{grant.definition.description}</p>
                <button
                  className={selected ? 'btn' : 'btn btn-primary'}
                  disabled={saving || selected}
                  onClick={() => void selectTitle(grant.id)}
                >
                  {selected ? 'Titre sélectionné' : 'Afficher ce titre'}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card" style={{ padding: 20, marginTop: 28 }}>
        <h2>Règles de confiance</h2>
        <p style={{ color: 'var(--muted)' }}>
          Aucun achat, abonnement, client modifié ou valeur locale ne peut créer un mérite. Une
          révocation administrative conserve l’historique et retire immédiatement un titre affiché.
        </p>
      </section>
    </main>
  );
}

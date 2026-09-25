'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Recommendation = {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
  };
  commonInterests: string[];
  scoreHint: number;
};

type RecommendationState = 'idle' | 'loading' | 'ready' | 'error';

export default function DiscoverPage() {
  const { user, loading: sessionLoading, error: sessionError } = useSession({
    realtime: false
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationState, setRecommendationState] = useState<RecommendationState>('idle');
  const [recommendationError, setRecommendationError] = useState('');

  useEffect(() => {
    let active = true;

    if (sessionLoading) return () => {
      active = false;
    };

    if (!user) {
      setRecommendations([]);
      setRecommendationState('idle');
      setRecommendationError('');
      return () => {
        active = false;
      };
    }

    setRecommendationState('loading');
    setRecommendationError('');

    void apiFetch<Recommendation[]>('/intelligence/recommendations')
      .then((data) => {
        if (!active) return;
        setRecommendations(data);
        setRecommendationState('ready');
      })
      .catch((cause) => {
        if (!active) return;
        setRecommendations([]);
        setRecommendationState('error');
        setRecommendationError(
          cause instanceof Error ? cause.message : 'Recommandations indisponibles.'
        );
      });

    return () => {
      active = false;
    };
  }, [sessionLoading, user?.id]);

  const entryPoints = [
    {
      key: 'PLAY',
      title: 'Jouer tout de suite',
      description: 'Commence par Quick Math en mode invité, sans créer de compte.',
      href: '/play/quick-math',
      cta: 'Jouer maintenant'
    },
    {
      key: 'DISCOVER',
      title: 'Découvrir ce qui te ressemble',
      description: user
        ? 'Parcours des profils réels recommandés à partir des signaux déjà disponibles.'
        : 'Connecte-toi seulement quand tu veux des recommandations personnelles.',
      href: user ? '#people' : '/login',
      cta: user ? 'Voir mes recommandations' : 'Personnaliser mes découvertes'
    },
    {
      key: 'CONNECT',
      title: 'Créer des liens',
      description: 'Recherche des profils, gère tes demandes et retrouve tes amis.',
      href: user ? '/friends' : '/login',
      cta: user ? 'Ouvrir mes connexions' : 'Se connecter'
    },
    {
      key: 'CREATE',
      title: 'Créer quelque chose',
      description: 'Transforme une idée en défi partageable sans ouvrir un gros studio.',
      href: user ? '/challenges' : '/login',
      cta: user ? 'Créer un défi' : 'Se connecter pour créer'
    }
  ];

  return (
    <main className="shell" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <header style={{ marginBottom: 26 }}>
        <small style={{ color: 'var(--mint)' }}>PLAY · DISCOVER · CONNECT · CREATE</small>
        <h1>Entre dans KnowMe par ce qui t’intéresse maintenant</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
          Pas besoin de tout faire à la fois : joue, découvre, connecte-toi ou crée. Les quatre
          chemins restent indépendants, puis se renforcent quand tu veux les relier.
        </p>
      </header>

      <section
        className="grid"
        aria-label="Entrées principales de KnowMe"
        style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', marginBottom: 34 }}
      >
        {entryPoints.map((entry) => (
          <article className="card" key={entry.key} style={{ padding: 20 }}>
            <small style={{ color: 'var(--mint)', fontWeight: 800 }}>{entry.key}</small>
            <h2 style={{ marginBottom: 8 }}>{entry.title}</h2>
            <p style={{ color: 'var(--muted)', minHeight: 66 }}>{entry.description}</p>
            <Link className="btn btn-primary" href={entry.href}>
              {entry.cta}
            </Link>
          </article>
        ))}
      </section>

      <section id="people" aria-labelledby="people-title">
        <header style={{ marginBottom: 18 }}>
          <small style={{ color: 'var(--mint)' }}>DISCOVER</small>
          <h2 id="people-title">Profils recommandés</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
            L’indice affiché sert à ordonner la découverte à partir des signaux disponibles. Ce
            n’est ni une note sur une personne, ni une garantie de compatibilité.
          </p>
        </header>

        {sessionLoading && (
          <div className="card" style={{ padding: 20 }} role="status">
            Préparation de ta découverte…
          </div>
        )}

        {!sessionLoading && !user && (
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ marginTop: 0 }}>La découverte personnalisée reste optionnelle</h3>
            <p style={{ color: 'var(--muted)' }}>
              Tu peux déjà jouer en invité. Connecte-toi seulement si tu veux afficher des profils
              recommandés à partir de tes centres d’intérêt et de ton activité KnowMe.
            </p>
            {sessionError && <p style={{ color: 'var(--muted)' }}>{sessionError}</p>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" href="/login">Se connecter</Link>
              <Link className="btn" href="/play/quick-math">Continuer sans compte</Link>
            </div>
          </div>
        )}

        {user && recommendationState === 'loading' && (
          <div className="card" style={{ padding: 20 }} role="status">
            Recherche de recommandations réelles…
          </div>
        )}

        {user && recommendationState === 'error' && (
          <div className="card" style={{ padding: 22 }} role="alert">
            <h3 style={{ marginTop: 0 }}>Impossible de charger les recommandations</h3>
            <p style={{ color: 'var(--muted)' }}>{recommendationError}</p>
            <Link className="btn" href="/friends">Rechercher un profil manuellement</Link>
          </div>
        )}

        {user && recommendationState === 'ready' && recommendations.length === 0 && (
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ marginTop: 0 }}>Pas encore assez de signaux</h3>
            <p style={{ color: 'var(--muted)' }}>
              Ajoute quelques centres d’intérêt à ton profil ou explore KnowMe. Les recommandations
              apparaîtront ici quand elles auront quelque chose d’utile à proposer.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" href="/profile">Compléter mon profil</Link>
              <Link className="btn" href="/friends">Rechercher quelqu’un</Link>
            </div>
          </div>
        )}

        {user && recommendationState === 'ready' && recommendations.length > 0 && (
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}
          >
            {recommendations.map((recommendation) => (
              <article className="card" key={recommendation.user.id} style={{ padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 4px' }}>{recommendation.user.displayName}</h3>
                    <div style={{ color: 'var(--muted)' }}>@{recommendation.user.username}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--mint)' }}>
                      {recommendation.scoreHint}%
                    </div>
                    <small style={{ color: 'var(--muted)' }}>indice</small>
                  </div>
                </div>

                {recommendation.user.bio && (
                  <p style={{ color: 'var(--muted)' }}>{recommendation.user.bio}</p>
                )}

                <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
                  {recommendation.commonInterests.length
                    ? 'Centres d’intérêt communs'
                    : 'Découverte basée sur les signaux disponibles'}
                </p>

                {recommendation.commonInterests.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {recommendation.commonInterests.map((interest) => (
                      <span
                        key={interest}
                        style={{
                          background: 'var(--surface-2)',
                          borderRadius: 999,
                          padding: '8px 12px'
                        }}
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
                  <Link
                    className="btn btn-primary"
                    href={`/profile/${encodeURIComponent(recommendation.user.username)}`}
                  >
                    Voir le profil
                  </Link>
                  <Link className="btn" href="/challenges">Créer un défi</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

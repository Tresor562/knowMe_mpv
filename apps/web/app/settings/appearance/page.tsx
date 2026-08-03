'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import {
  APPEARANCE_EVENT,
  AppearanceResponse,
  AppearanceTheme,
  saveLocalAppearance
} from '../../../lib/appearance';
import { useSession } from '../../../lib/use-session';

function ThemeCard({
  theme,
  selected,
  busy,
  onSelect
}: {
  theme: AppearanceTheme;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className="card"
      style={{
        padding: 18,
        borderWidth: selected ? 3 : 1,
        display: 'grid',
        gap: 12
      }}
      aria-current={selected ? 'true' : undefined}
    >
      <div
        aria-hidden="true"
        style={{
          height: 82,
          borderRadius: 16,
          padding: 12,
          background: theme.palette.background === 'adaptive'
            ? 'linear-gradient(90deg, #f6fbf8 0 50%, #071410 50%)'
            : theme.palette.background,
          color: theme.palette.text === 'adaptive' ? '#102019' : theme.palette.text,
          border: `1px solid ${theme.palette.accent}`
        }}
      >
        <div
          style={{
            width: '70%',
            height: 16,
            borderRadius: 99,
            background: theme.palette.accent
          }}
        />
        <div
          style={{
            width: '45%',
            height: 10,
            borderRadius: 99,
            marginTop: 12,
            background: theme.palette.surface === 'adaptive'
              ? 'rgba(255,255,255,.72)'
              : theme.palette.surface
          }}
        />
      </div>
      <div>
        <small style={{ color: 'var(--mint)' }}>
          {theme.premium ? 'PREMIUM' : theme.mode}
        </small>
        <h2 style={{ marginBottom: 8 }}>{theme.name}</h2>
        <p style={{ color: 'var(--muted)', margin: 0 }}>{theme.description}</p>
      </div>
      <button
        className={selected ? 'btn' : 'btn btn-primary'}
        disabled={busy || theme.locked || selected}
        onClick={onSelect}
      >
        {theme.locked ? 'Droit requis' : selected ? 'Sélectionné' : 'Appliquer'}
      </button>
    </article>
  );
}

export default function AppearanceSettingsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [appearance, setAppearance] = useState<AppearanceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<AppearanceResponse>('/appearance');
      setAppearance(response);
      saveLocalAppearance(response.preference);
      if (response.preference.fallbackReason) {
        setMessage('Le thème sélectionné n’est plus disponible. Le mode système est appliqué sans perte de préférence.');
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Préférences d’apparence indisponibles.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function update(input: {
    themeKey?: string;
    contrast?: 'STANDARD' | 'HIGH';
    reduceTransparency?: boolean;
  }) {
    if (!appearance) return;
    setBusy(true);
    try {
      const response = await apiFetch<AppearanceResponse>('/appearance', {
        method: 'PATCH',
        body: JSON.stringify({
          ...input,
          expectedVersion: appearance.preference.version
        })
      });
      setAppearance(response);
      saveLocalAppearance(response.preference);
      window.dispatchEvent(
        new CustomEvent(APPEARANCE_EVENT, { detail: response.preference })
      );
      setMessage('Apparence synchronisée sur ton compte.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Mise à jour impossible.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || !user || !appearance) {
    return <main className="shell"><p>{message || 'Chargement de l’apparence…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>KMD-031 · APPARENCE</small>
        <h1>Thème de l’application</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
          Choisis une palette statique. Aucun thème ne modifie les fonctions, la priorité sociale,
          les récompenses ou les performances du compte.
        </p>
        <a className="btn" href="/profile">Retour au profil</a>
      </header>

      {message && <p role="status">{message}</p>}

      <section
        aria-label="Thèmes disponibles"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 16,
          marginTop: 24
        }}
      >
        {appearance.themes.map((theme) => (
          <ThemeCard
            key={theme.key}
            theme={theme}
            selected={appearance.preference.selectedThemeKey === theme.key}
            busy={busy}
            onSelect={() => void update({ themeKey: theme.key })}
          />
        ))}
      </section>

      <section className="card" style={{ padding: 22, marginTop: 24 }}>
        <h2>Accessibilité visuelle</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            Contraste
            <select
              value={appearance.preference.contrast}
              disabled={busy}
              onChange={(event) =>
                void update({ contrast: event.target.value as 'STANDARD' | 'HIGH' })
              }
            >
              <option value="STANDARD">Standard</option>
              <option value="HIGH">Élevé</option>
            </select>
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={appearance.preference.reduceTransparency}
              disabled={busy}
              onChange={(event) =>
                void update({ reduceTransparency: event.target.checked })
              }
            />
            Réduire les transparences et les effets de flou
          </label>
        </div>
      </section>

      <section className="card" style={{ padding: 22, marginTop: 24 }}>
        <h2>Synchronisation</h2>
        <p style={{ color: 'var(--muted)' }}>
          Version serveur : <strong>{appearance.preference.version}</strong> · Thème effectif :{' '}
          <strong>{appearance.preference.effectiveThemeKey}</strong> · Fallback sûr :{' '}
          <strong>{String(appearance.rules.safeFallbackThemeKey)}</strong>
        </p>
      </section>
    </main>
  );
}

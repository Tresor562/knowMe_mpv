'use client';

import { AnimationPreferenceMode } from '@knowme/animation-contract';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { createWebAnimationPlan, reportWebAnimation } from '../../lib/animation-manager';
import { useSession } from '../../lib/use-session';

type Preference = {
  userId: string;
  mode: AnimationPreferenceMode;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
};

type EventDefinition = {
  key: string;
  category: string;
  fallbackSymbol: string;
  fallbackLabel: string;
  maxDurationMs: number;
};

export default function ConceptKPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [preference, setPreference] = useState<Preference | null>(null);
  const [events, setEvents] = useState<EventDefinition[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('LEVEL_UP');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [currentPreference, catalog] = await Promise.all([
        apiFetch<Preference>('/concept-k/preferences'),
        apiFetch<{ events: EventDefinition[] }>('/concept-k/catalog')
      ]);
      setPreference(currentPreference);
      setEvents(catalog.events);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Concept K indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  const plan = useMemo(() => {
    if (!preference) return null;
    return createWebAnimationPlan({ eventKey: selectedEvent, preference });
  }, [preference, selectedEvent]);

  async function save(next: Preference) {
    setPreference(next);
    try {
      const saved = await apiFetch<Preference>('/concept-k/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          mode: next.mode,
          soundEnabled: next.soundEnabled,
          hapticsEnabled: next.hapticsEnabled
        })
      });
      setPreference(saved);
      setMessage('Préférences Concept K enregistrées.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
      await load();
    }
  }

  async function preview() {
    if (!plan) return;
    const startedAt = performance.now();
    setMessage(
      plan.variant === 'STATIC'
        ? `${plan.event.fallbackSymbol} ${plan.event.fallbackLabel} — fallback statique.`
        : `${plan.event.fallbackSymbol} Prévisualisation ${plan.variant.toLowerCase()}, toujours ignorable.`
    );
    try {
      await reportWebAnimation({
        eventKey: selectedEvent,
        outcome: plan.variant === 'STATIC' ? 'FALLBACK' : 'PLAYED',
        durationMs: Math.round(performance.now() - startedAt),
        assetBytes: 0
      });
    } catch {
      // La télémétrie ne doit jamais bloquer l’expérience.
    }
  }

  if (sessionLoading || !user || !preference) {
    return <main className="shell"><p>{message || 'Chargement de Concept K…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 920, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>CONCEPT K</small>
        <h1>Animations accessibles et non bloquantes</h1>
        <p style={{ color: 'var(--muted)' }}>
          Chaque événement possède un fallback statique. Le réglage système de mouvement réduit
          reste prioritaire, même lorsque le mode automatique est actif.
        </p>
      </header>

      {message && <p role="status">{message}</p>}

      <section className="card" style={{ padding: 22, display: 'grid', gap: 18 }}>
        <h2>Intensité</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['AUTO', 'REDUCED', 'OFF'] as const).map((mode) => (
            <button
              className={preference.mode === mode ? 'btn btn-primary' : 'btn'}
              key={mode}
              onClick={() => void save({ ...preference, mode })}
            >
              {mode === 'AUTO' ? 'Automatique' : mode === 'REDUCED' ? 'Réduite' : 'Désactivée'}
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={preference.soundEnabled}
            onChange={(event) => void save({ ...preference, soundEnabled: event.target.checked })}
          />
          Autoriser les sons Concept K lorsqu’ils sont prévus
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={preference.hapticsEnabled}
            onChange={(event) => void save({ ...preference, hapticsEnabled: event.target.checked })}
          />
          Autoriser les vibrations légères sur les appareils compatibles
        </label>
      </section>

      <section className="card" style={{ padding: 22, marginTop: 22 }}>
        <h2>Prévisualiser le plan</h2>
        <select value={selectedEvent} onChange={(event) => setSelectedEvent(event.target.value)}>
          {events.map((event) => (
            <option key={event.key} value={event.key}>{event.fallbackLabel}</option>
          ))}
        </select>
        {plan && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 64 }}>{plan.event.fallbackSymbol}</div>
            <p><strong>Variante :</strong> {plan.variant}</p>
            <p><strong>Raison :</strong> {plan.reason}</p>
            <p><strong>Durée maximale :</strong> {plan.event.maxDurationMs} ms</p>
            <p><strong>Bloquante :</strong> non · <strong>Ignorable :</strong> oui</p>
            <button className="btn btn-primary" onClick={() => void preview()}>
              Prévisualiser sans bloquer
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

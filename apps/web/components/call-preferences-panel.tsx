'use client';

import type { FormEvent } from 'react';
import {
  minuteToTime,
  timeToMinute,
  type CallPreferenceFields,
  type CallPreferenceView,
} from '../lib/call-preparation';

type CallPreferencesPanelProps = {
  preferences: CallPreferenceView | null;
  message: string;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPatch: (patch: Partial<CallPreferenceFields>) => void;
  onMicrophoneDefaultChange: (enabled: boolean) => void;
  onCameraDefaultChange: (enabled: boolean) => void;
};

export function CallPreferencesPanel({
  preferences,
  message,
  saving,
  onSubmit,
  onPatch,
  onMicrophoneDefaultChange,
  onCameraDefaultChange,
}: CallPreferencesPanelProps) {
  return (
    <section className="card" style={{ padding: 22, marginBottom: 20 }}>
      <h2>Ma disponibilité</h2>
      <p style={{ color: 'var(--muted)' }}>
        Ces règles sont appliquées par le serveur sans révéler à l’appelant la
        raison précise d’une indisponibilité.
      </p>
      {preferences ? (
        <form className="grid" onSubmit={onSubmit}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            }}
          >
            <label className="card" style={{ padding: 14 }}>
              <input
                type="checkbox"
                checked={preferences.incomingCallsEnabled}
                onChange={(event) =>
                  onPatch({ incomingCallsEnabled: event.target.checked })
                }
              />{' '}
              Recevoir des appels
            </label>
            <label className="card" style={{ padding: 14 }}>
              <input
                type="checkbox"
                checked={preferences.allowAudioCalls}
                onChange={(event) =>
                  onPatch({ allowAudioCalls: event.target.checked })
                }
              />{' '}
              Autoriser l’audio
            </label>
            <label className="card" style={{ padding: 14 }}>
              <input
                type="checkbox"
                checked={preferences.allowVideoCalls}
                onChange={(event) =>
                  onPatch({ allowVideoCalls: event.target.checked })
                }
              />{' '}
              Autoriser la vidéo
            </label>
            <label className="card" style={{ padding: 14 }}>
              <input
                type="checkbox"
                checked={preferences.quietHoursEnabled}
                onChange={(event) =>
                  onPatch({ quietHoursEnabled: event.target.checked })
                }
              />{' '}
              Activer les heures calmes
            </label>
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
            }}
          >
            <label>
              Début du silence
              <input
                type="time"
                value={minuteToTime(preferences.quietStartMinute)}
                disabled={!preferences.quietHoursEnabled}
                onChange={(event) =>
                  onPatch({
                    quietStartMinute: timeToMinute(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Fin du silence
              <input
                type="time"
                value={minuteToTime(preferences.quietEndMinute)}
                disabled={!preferences.quietHoursEnabled}
                onChange={(event) =>
                  onPatch({
                    quietEndMinute: timeToMinute(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Fuseau horaire IANA
              <input
                value={preferences.timezone}
                required
                placeholder="Africa/Porto-Novo"
                onChange={(event) => onPatch({ timezone: event.target.value })}
              />
            </label>
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            }}
          >
            <label className="card" style={{ padding: 14 }}>
              <input
                type="checkbox"
                checked={preferences.microphoneEnabledByDefault}
                onChange={(event) =>
                  onMicrophoneDefaultChange(event.target.checked)
                }
              />{' '}
              Micro actif par défaut
            </label>
            <label className="card" style={{ padding: 14 }}>
              <input
                type="checkbox"
                checked={preferences.cameraEnabledByDefault}
                onChange={(event) =>
                  onCameraDefaultChange(event.target.checked)
                }
              />{' '}
              Caméra active par défaut
            </label>
            <label className="card" style={{ padding: 14 }}>
              <input
                type="checkbox"
                checked={preferences.devicePreviewRequired}
                onChange={(event) =>
                  onPatch({ devicePreviewRequired: event.target.checked })
                }
              />{' '}
              Test obligatoire avant l’appel
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <small style={{ color: 'var(--muted)', alignSelf: 'center' }}>
              Version {preferences.version}
              {preferences.persisted
                ? ' · enregistrée'
                : ' · valeurs par défaut'}
            </small>
          </div>
          {message ? (
            <p role="status" aria-live="polite" style={{ margin: 0 }}>
              {message}
            </p>
          ) : null}
        </form>
      ) : (
        <p role={message ? 'alert' : undefined}>
          {message || 'Chargement des préférences…'}
        </p>
      )}
    </section>
  );
}

'use client';

import type {
  BrowserMediaPermission,
  CallMedia,
  MediaPreparationState,
} from '../lib/call-preparation';

type CallPreparationPanelProps = {
  media: CallMedia;
  state: MediaPreparationState;
  message: string;
  microphonePermission: BrowserMediaPermission;
  cameraPermission: BrowserMediaPermission;
  microphones: MediaDeviceInfo[];
  cameras: MediaDeviceInfo[];
  selectedMicrophoneId: string;
  selectedCameraId: string;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  preparing: boolean;
  callActive: boolean;
  localMediaActive: boolean;
  onMediaChange: (media: CallMedia) => void;
  onDeviceChange: (kind: 'microphone' | 'camera', deviceId: string) => void;
  onMicrophoneToggle: (enabled: boolean) => void;
  onCameraToggle: (enabled: boolean) => void;
  onPrepare: () => void;
  onStop: () => void;
};

function permissionLabel(state: BrowserMediaPermission) {
  switch (state) {
    case 'granted':
      return 'Autorisée';
    case 'denied':
      return 'Refusée';
    case 'prompt':
      return 'À demander';
    case 'unsupported':
      return 'Non prise en charge';
    default:
      return 'À vérifier pendant le test';
  }
}

function preparationLabel(state: MediaPreparationState) {
  switch (state) {
    case 'requesting':
      return 'Demande de permission en cours…';
    case 'ready':
      return 'Appareils prêts';
    case 'denied':
      return 'Permission refusée';
    case 'missing-device':
      return 'Appareil absent';
    case 'device-busy':
      return 'Appareil indisponible';
    case 'unsupported-constraint':
      return 'Sélection à actualiser';
    case 'unsupported':
      return 'Navigateur non compatible';
    case 'error':
      return 'Préparation échouée';
    default:
      return 'Test non lancé';
  }
}

export function CallPreparationPanel({
  media,
  state,
  message,
  microphonePermission,
  cameraPermission,
  microphones,
  cameras,
  selectedMicrophoneId,
  selectedCameraId,
  microphoneEnabled,
  cameraEnabled,
  preparing,
  callActive,
  localMediaActive,
  onMediaChange,
  onDeviceChange,
  onMicrophoneToggle,
  onCameraToggle,
  onPrepare,
  onStop,
}: CallPreparationPanelProps) {
  return (
    <section className="card grid" style={{ padding: 22, marginBottom: 20 }}>
      <div>
        <h2>Préparer mes appareils</h2>
        <p style={{ color: 'var(--muted)' }}>
          La liste, les identifiants et l’aperçu restent dans ce navigateur.
          L’accès commence uniquement avec « Tester mes appareils ».
        </p>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}
      >
        <article className="card" style={{ padding: 14 }}>
          <strong>Microphone</strong>
          <p style={{ marginBottom: 0 }}>
            {permissionLabel(microphonePermission)}
          </p>
        </article>
        <article className="card" style={{ padding: 14 }}>
          <strong>Caméra</strong>
          <p style={{ marginBottom: 0 }}>{permissionLabel(cameraPermission)}</p>
        </article>
        <article className="card" style={{ padding: 14 }}>
          <strong>Préparation</strong>
          <p style={{ marginBottom: 0 }}>{preparationLabel(state)}</p>
        </article>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}
      >
        <label>
          Mode à préparer
          <select
            value={media}
            disabled={preparing || callActive}
            onChange={(event) => onMediaChange(event.target.value as CallMedia)}
          >
            <option value="audio">Audio</option>
            <option value="video">Audio et vidéo</option>
          </select>
        </label>
        <label>
          Microphone
          <select
            value={selectedMicrophoneId}
            disabled={preparing || callActive}
            onChange={(event) =>
              onDeviceChange('microphone', event.target.value)
            }
          >
            <option value="">Appareil par défaut</option>
            {microphones.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Caméra
          <select
            value={selectedCameraId}
            disabled={preparing || callActive || media === 'audio'}
            onChange={(event) => onDeviceChange('camera', event.target.value)}
          >
            <option value="">Appareil par défaut</option>
            {cameras.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Caméra ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <label>
          <input
            type="checkbox"
            checked={microphoneEnabled}
            disabled={preparing}
            onChange={(event) => onMicrophoneToggle(event.target.checked)}
          />{' '}
          Micro actif
        </label>
        <label>
          <input
            type="checkbox"
            checked={cameraEnabled}
            disabled={preparing || media === 'audio'}
            onChange={(event) => onCameraToggle(event.target.checked)}
          />{' '}
          Caméra active
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={preparing || callActive}
          onClick={onPrepare}
        >
          {preparing ? 'Préparation…' : 'Tester mes appareils'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!localMediaActive || callActive}
          onClick={onStop}
        >
          Arrêter l’aperçu
        </button>
      </div>
      <p role="status" aria-live="polite" style={{ margin: 0 }}>
        {message}
      </p>
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { apiFetch, apiFetchBlob } from '../../../lib/api';

export type MediaPresentation = {
  kind: 'VOICE_NOTE' | 'VIDEO_NOTE';
  assetId: string;
  mimeType: string;
  durationSeconds: number;
  voicePreset: 'ORIGINAL' | 'DEEP' | 'BRIGHT' | 'ROBOT' | null;
  transformedVoice: boolean;
  mediaAccess: 'AUTHENTICATED_CONVERSATION';
};

export function MessageMedia({ presentation }: { presentation: MediaPresentation }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    void (async () => {
      setLoading(true);
      setError('');
      try {
        const grant = await apiFetch<{ path: string }>(
          `/media/${presentation.assetId}/download-grant`,
          { method: 'POST' }
        );
        const blob = await apiFetchBlob(grant.path);
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Média indisponible.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [presentation.assetId]);

  if (loading) {
    return <span style={{ color: 'var(--muted)' }}>Chargement du média…</span>;
  }
  if (error || !url) {
    return <span style={{ color: 'var(--orange)' }}>{error || 'Média indisponible.'}</span>;
  }

  if (presentation.kind === 'VIDEO_NOTE') {
    return (
      <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          style={{
            width: 240,
            height: 240,
            maxWidth: '68vw',
            maxHeight: '68vw',
            objectFit: 'cover',
            borderRadius: '50%',
            background: '#050807'
          }}
        />
        <small style={{ opacity: .72 }}>
          Note vidéo · {Math.max(1, Math.round(presentation.durationSeconds))} s
        </small>
      </div>
    );
  }

  const voiceLabel =
    presentation.voicePreset === 'DEEP'
      ? 'Grave'
      : presentation.voicePreset === 'BRIGHT'
        ? 'Claire'
        : presentation.voicePreset === 'ROBOT'
          ? 'Robot'
          : 'Originale';

  return (
    <div style={{ display: 'grid', gap: 5, minWidth: 220 }}>
      <audio src={url} controls preload="metadata" style={{ width: '100%' }} />
      <small style={{ opacity: .72 }}>
        Vocal · {Math.max(1, Math.round(presentation.durationSeconds))} s
        {presentation.transformedVoice ? ` · voix ${voiceLabel}` : ''}
      </small>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './post-video-player.css';

type PlaybackRate = 1 | 1.25 | 1.5 | 2;
const RATES: PlaybackRate[] = [1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  return h ? [h, String(m).padStart(2,'0'), String(s).padStart(2,'0')].join(':')
    : [m, String(s).padStart(2,'0')].join(':');
}

/**
 * Controls for media already attached to a KnowMe publication.
 * A later transport project must add resumable upload + HTTP byte-range
 * streaming before multi-hour Reels are supported in production.
 */
export function PostVideoPlayer({ src, en = false }: { src: string; en?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState<PlaybackRate>(1);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);

  const syncTime = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setPosition(el.currentTime || 0);
    setDuration(Number.isFinite(el.duration) ? el.duration : 0);
  }, []);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      const video = videoRef.current;
      if (video) video.pause();
    };
  }, []);

  const toggle = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setError('');
    if (!video.paused) {
      video.pause();
      return;
    }
    try {
      await video.play();
    } catch {
      setError(en ? 'Cannot start this video.' : 'Lecture vidéo impossible.');
    }
  }, [en]);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const max = Number.isFinite(video.duration) ? video.duration : 0;
    if (!max) return;
    video.currentTime = Math.max(0, Math.min(max, video.currentTime + delta));
    syncTime();
  }, [syncTime]);

  function onSurfaceClick(event: React.MouseEvent<HTMLButtonElement>) {
    const now = Date.now();
    const previous = lastTap.current;
    const rect = event.currentTarget.getBoundingClientRect();
    const leftHalf = event.clientX - rect.left < rect.width / 2;
    lastTap.current = now;
    if (now - previous < 310) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = null;
      lastTap.current = 0;
      seekBy(leftHalf ? -10 : 10);
      return;
    }
    tapTimer.current = setTimeout(() => {
      void toggle();
      tapTimer.current = null;
    }, 310);
  }

  function seekTo(value: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(value) || duration <= 0) return;
    const next = Math.max(0, Math.min(duration, value));
    video.currentTime = next;
    setPosition(next);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function switchRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]!;
    if (videoRef.current) videoRef.current.playbackRate = next;
    setRate(next);
  }

  async function toggleFullscreen() {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (document.fullscreenElement === shell) await document.exitFullscreen();
      else if (shell.requestFullscreen) await shell.requestFullscreen();
    } catch {
      setError(en ? 'Fullscreen unavailable here.' : 'Plein écran indisponible.');
    }
  }

  return (
    <div className="km-post-video-player" ref={shellRef} tabIndex={0}
      aria-label={en ? 'Publication video player' : 'Lecteur vidéo de la publication'}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          void toggle();
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          seekBy(-10);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          seekBy(10);
        }
      }}>
      <video ref={videoRef} src={src} preload="metadata" playsInline
        onTimeUpdate={syncTime} onLoadedMetadata={syncTime} onDurationChange={syncTime}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setError(en ? 'Video unavailable.' : 'Vidéo indisponible.')}
        aria-label={en ? 'Post video' : 'Vidéo de la publication'} />
      <button type="button" className="km-post-video-tap"
        aria-label={playing ? (en ? 'Pause video' : 'Mettre la vidéo en pause')
          : (en ? 'Play video' : 'Lire la vidéo')}
        onClick={onSurfaceClick}>
        {!playing && <span className="km-post-video-play" aria-hidden="true">▶</span>}
      </button>
      <div className="km-post-video-controls">
        <div className="km-post-video-progress">
          <input type="range" min={0} max={duration || 1} step={0.1}
            value={Math.min(seekPreview ?? position, duration || 1)}
            disabled={!duration} aria-label={en ? 'Seek video' : 'Déplacer la lecture'}
            onChange={event => {
              const next = Number(event.target.value);
              setSeekPreview(next);
              seekTo(next);
            }}
            onPointerUp={() => setSeekPreview(null)}
            onBlur={() => setSeekPreview(null)}/>
          <span className="km-post-video-time">
            {formatTime(seekPreview ?? position)} / {formatTime(duration)}
          </span>
        </div>
        <div className="km-post-video-toolbar">
          <button type="button" onClick={() => void toggle()} aria-label={playing
            ? (en ? 'Pause' : 'Pause') : (en ? 'Play' : 'Lecture')}>{playing ? 'Ⅱ' : '▶'}</button>
          <button type="button" onClick={() => seekBy(-10)} aria-label={en ? 'Rewind 10 seconds' : 'Reculer de 10 secondes'}>↶10</button>
          <button type="button" onClick={() => seekBy(10)} aria-label={en ? 'Forward 10 seconds' : 'Avancer de 10 secondes'}>10↷</button>
          <button type="button" onClick={toggleMute} aria-label={muted ? (en ? 'Unmute' : 'Activer le son') : (en ? 'Mute' : 'Couper le son')}>{muted ? '🔇' : '🔊'}</button>
          <button type="button" onClick={switchRate} aria-label={en ? 'Playback speed' : 'Vitesse de lecture'}>{rate}×</button>
          <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? (en ? 'Exit fullscreen' : 'Quitter le plein écran') : (en ? 'Fullscreen' : 'Plein écran')}>⛶</button>
        </div>
        {error && <p role="alert" className="km-post-video-error">{error}</p>}
      </div>
    </div>
  );
}

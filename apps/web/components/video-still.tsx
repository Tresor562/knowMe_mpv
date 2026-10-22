'use client';

import { useEffect, useRef, useState } from 'react';

/** Bounded, in-memory genuine video stills; never store user media in localStorage. */
const cache = new Map<string, string>();
const CACHE_LIMIT = 24;

function remember(src: string, poster: string) {
  cache.delete(src);
  cache.set(src, poster);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

type CaptureState = 'pending' | 'decoded' | 'fallback' | 'unavailable';

/**
 * Prefer a decoded canvas still. Cross-origin MP4s can play but cannot be read by
 * canvas (tainted bitmap); for that case show a muted, paused native video surface
 * with NO browser transport controls. Never pretend a blank block is a thumbnail.
 * Failed codecs retain the play affordance and are handled by the real player.
 */
export function VideoStill({ src, className = 'km-post-collage-poster' }: {
  src: string;
  className?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  const [still, setStill] = useState<string | null>(() => cache.get(src) ?? null);
  const [captureState, setCaptureState] = useState<CaptureState>('pending');

  useEffect(() => {
    setStill(cache.get(src) ?? null);
    setCaptureState('pending');
    setNear(false);
  }, [src]);

  useEffect(() => {
    const node = root.current;
    if (!node || still) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const rail = node.closest('.km-feed-reel-rail');
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { root: rail, rootMargin: rail ? '0px 120px 0px 120px' : '280px 120px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [src, still]);

  useEffect(() => {
    if (!near || !src || cache.has(src)) return;
    let cancelled = false;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const cleanup = () => {
      video.onloadeddata = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
    video.onloadeddata = () => {
      if (cancelled) return;
      let captured = false;
      try {
        if (video.videoWidth && video.videoHeight) {
          const canvas = document.createElement('canvas');
          const ratio = Math.min(1, 480 / video.videoWidth, 480 / video.videoHeight);
          canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
          canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
          const context = canvas.getContext('2d');
          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const poster = canvas.toDataURL('image/jpeg', 0.7);
            if (poster.startsWith('data:image/jpeg')) {
              remember(src, poster);
              setStill(poster);
              captured = true;
            }
          }
        }
      } catch {
        // Canvas export often fails under browser cross-origin restrictions,
        // even for an MP4 that is otherwise fully playable.
      } finally {
        if (!cancelled) setCaptureState(captured ? 'decoded' : 'fallback');
        cleanup();
      }
    };
    video.onerror = () => {
      if (!cancelled) setCaptureState('unavailable');
      cleanup();
    };
    video.src = src;
    video.load();
    return () => { cancelled = true; cleanup(); };
  }, [near, src]);

  return <span ref={root} className={className} aria-hidden="true">
    {still
      ? <img src={still} alt="" draggable={false} />
      : near && captureState === 'fallback'
        ? <video src={src} preload="auto" muted playsInline disablePictureInPicture
            controls={false} tabIndex={-1} draggable={false}
            onLoadedData={event => event.currentTarget.pause()} />
        : null}
  </span>;
}

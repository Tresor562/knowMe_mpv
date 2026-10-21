'use client';

import { useEffect, useRef, useState } from 'react';

/** Bounded, in-memory thumbnails: never store a user's videos in localStorage. */
const cache = new Map<string, string>();
const CACHE_LIMIT = 24;

function remember(src: string, poster: string) {
  cache.delete(src);
  cache.set(src, poster);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

/**
 * Creates a still from the actual published video, near the viewport only.
 * The temporary media element never enters the document or shows native controls.
 * If decoding is unavailable, show the play affordance without a false image.
 */
export function VideoStill({ src }: { src: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  const [still, setStill] = useState<string | null>(() => cache.get(src) ?? null);

  useEffect(() => {
    const node = root.current;
    if (!node || still) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: '280px 120px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [src, still]);

  useEffect(() => {
    setStill(cache.get(src) ?? null);
  }, [src]);

  useEffect(() => {
    if (!near || !src || cache.has(src)) return;
    let cancelled = false;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const capture = () => {
      if (cancelled || video.videoWidth <= 0 || video.videoHeight <= 0) return;
      try {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(1, 480 / video.videoWidth, 480 / video.videoHeight);
        canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
        canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const poster = canvas.toDataURL('image/jpeg', 0.7);
        if (!cancelled && poster.startsWith('data:image/jpeg')) {
          remember(src, poster);
          setStill(poster);
          cleanup();
        }
      } catch { /* Canvas can be blocked by CORS/codec; leave honest fallback. */ }
    };
    const onData = () => {
      // The first decoded frame is a genuine cover, even without seeking support.
      capture();
    };
    const cleanup = () => {
      video.onloadeddata = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
    video.onloadeddata = onData;
    video.onerror = cleanup;
    video.src = src;
    video.load();
    return () => { cancelled = true; cleanup(); };
  }, [near, src]);

  return <span ref={root} className="km-post-collage-poster" aria-hidden="true">
    {still && <img src={still} alt="" draggable={false} />}
  </span>;
}

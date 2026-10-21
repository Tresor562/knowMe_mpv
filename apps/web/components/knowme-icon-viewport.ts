'use client';

import { useEffect, useRef, useState } from 'react';

/** One observer for every actively animated visible icon in KnowMe.
 * Idle icons never register. The browser handles intersection batching; this
 * prevents hundreds of per-glyph observers and background animation loops.
 */
const listeners = new Map<Element, Set<(visible: boolean) => void>>();
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        listeners.get(entry.target)?.forEach(fn => fn(entry.isIntersecting));
      }
    }, { rootMargin: '64px 0px', threshold: 0 });
  }
  return sharedObserver;
}

export function useKnowMeIconViewportVisible(watching: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!watching) { setVisible(true); return; }
    const node = ref.current;
    const observer = node ? getSharedObserver() : null;
    if (!node || !observer) return;

    const callback = (next: boolean) => setVisible(next);
    let callbacks = listeners.get(node);
    if (!callbacks) {
      callbacks = new Set();
      listeners.set(node, callbacks);
      observer.observe(node);
    }
    callbacks.add(callback);
    return () => {
      const current = listeners.get(node);
      current?.delete(callback);
      if (current?.size === 0) {
        observer.unobserve(node);
        listeners.delete(node);
      }
      if (!listeners.size) {
        observer.disconnect();
        sharedObserver = null;
      }
    };
  }, [watching]);

  return { ref, visible };
}

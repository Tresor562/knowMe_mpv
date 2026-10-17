'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { apiFetch, getAccessToken } from '../lib/api';
import { getRealtimeSocket } from '../lib/realtime';

export type RuntimeBadge = { key: string; label: string; color: string; symbol: 'check' | 'star' | 'spark' };
export type RuntimeModule = { key: string; title: string; kind: 'notice' | 'link' | 'tile'; href?: string };
type RuntimeConfig = { revision: number; document: { badges: RuntimeBadge[]; modules: RuntimeModule[] } };
const DEFAULT: RuntimeConfig = { revision: 0, document: {
  badges: [
    { key: 'verified_blue', label: 'Compte certifié KnowMe', color: '#1877F2', symbol: 'check' },
    { key: 'staff_gold', label: 'Équipe KnowMe', color: '#E5AD31', symbol: 'check' }
  ], modules: []
} };

// Shared external store avoids conflicting React Provider types across the monorepo.
let current: RuntimeConfig = DEFAULT;
const listeners = new Set<() => void>();
function notify(next: RuntimeConfig) {
  if (JSON.stringify(current) === JSON.stringify(next)) return;
  current = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useRuntimeExperience() {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT);
}
export function RuntimeExperienceProvider({ children }: { children: React.ReactNode }) {
  const refresh = useCallback(async () => {
    // Public/login pages must never probe an unavailable protected backend.
    if (!getAccessToken()) return;
    try {
      const result = await apiFetch<RuntimeConfig>('/runtime-experience');
      if (Array.isArray(result?.document?.badges) && Array.isArray(result?.document?.modules)) {
        notify(result);
      }
    } catch { /* Preserve last known good config while offline. */ }
  }, []);
  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 60000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', refresh);
    const socket = getRealtimeSocket();
    socket.on('runtime-experience:changed', refresh);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', refresh);
      socket.off('runtime-experience:changed', refresh);
    };
  }, [refresh]);
  return <>{children}</>;
}
export function useRuntimeBadge(key: string) {
  const { document } = useRuntimeExperience();
  return document.badges.find(badge => badge.key === key);
}

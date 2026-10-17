'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
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
const Context = createContext<RuntimeConfig>(DEFAULT);
export function RuntimeExperienceProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState(DEFAULT);
  const refresh = useCallback(async () => {
    try {
      const result = await apiFetch<RuntimeConfig>('/runtime-experience');
      if (Array.isArray(result?.document?.badges) && Array.isArray(result?.document?.modules)) {
        setConfig(result);
      }
    } catch { /* Preserve last known good configuration during outages. */ }
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
  return <Context.Provider value={config}>{children}</Context.Provider>;
}
export function useRuntimeExperience() { return useContext(Context); }
export function useRuntimeBadge(key: string) {
  const { document } = useRuntimeExperience();
  return document.badges.find(badge => badge.key === key);
}

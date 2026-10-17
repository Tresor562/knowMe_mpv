import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { apiFetch } from './api';
import { getRealtimeSocket } from './realtime';

export type RuntimeBadge = {
  key: string; label: string; color: string; symbol: 'check' | 'star' | 'spark'
};
export type RuntimeModule = {
  key: string; title: string; kind: 'notice' | 'link' | 'tile'; href?: string
};
type RuntimeConfig = {
  revision: number; document: { badges: RuntimeBadge[]; modules: RuntimeModule[] }
};
const DEFAULT: RuntimeConfig = {
  revision: 0, document: {
    badges: [
      { key:'verified_blue', label:'Compte certifié KnowMe', color:'#1877F2', symbol:'check' },
      { key:'staff_gold', label:'Équipe KnowMe', color:'#E5AD31', symbol:'check' }
    ],
    modules:[]
  }
};
const Context = createContext<RuntimeConfig>(DEFAULT);
export function RuntimeExperienceProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState(DEFAULT);
  const refresh = useCallback(async () => {
    try {
      const result = await apiFetch<RuntimeConfig>('/runtime-experience');
      if (Array.isArray(result?.document?.badges) && Array.isArray(result?.document?.modules)) {
        setConfig(result);
      }
    } catch { /* Preserve the last configuration if the API is temporarily offline. */ }
  }, []);
  useEffect(() => {
    let alive = true;
    void refresh();
    const poll = setInterval(() => { if (alive) void refresh(); }, 60000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    let unbind = () => {};
    void getRealtimeSocket().then(socket => {
      if (!alive || !socket) return;
      socket.on('runtime-experience:changed', refresh);
      unbind = () => socket.off('runtime-experience:changed', refresh);
    });
    return () => { alive=false; clearInterval(poll); app.remove(); unbind(); };
  }, [refresh]);
  return <Context.Provider value={config}>{children}</Context.Provider>;
}
export function useRuntimeBadge(key: string) {
  return useContext(Context).document.badges.find(badge => badge.key === key);
}
export function useRuntimeModules() { return useContext(Context).document.modules; }

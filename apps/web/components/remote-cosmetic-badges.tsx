'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { getRealtimeSocket } from '../lib/realtime';
import type { RuntimeBadge } from './runtime-experience-provider';

// Decorative only. Official certification and staff status are never inferred from this list.
const cache = new Map<string, RuntimeBadge[]>();
export function RemoteCosmeticBadges({ username, size = 18 }: { username: string; size?: number }) {
  const normalized = username.toLowerCase().replace(/^@/, '');
  const [badges, setBadges] = useState<RuntimeBadge[]>(() => cache.get(normalized) ?? []);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DYNAMIC_RUNTIME_ENABLED !== 'true') return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await apiFetch<{ badges: RuntimeBadge[] }>(
          '/runtime-experience/badges/' + encodeURIComponent(normalized)
        );
        if (active && Array.isArray(response.badges)) {
          cache.set(normalized, response.badges);
          setBadges(response.badges);
        }
      } catch { /* Retain current badges while offline. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    const socket = getRealtimeSocket();
    socket.on('runtime-badge:changed', refresh);
    return () => {
      active = false; window.clearInterval(timer); socket.off('runtime-badge:changed', refresh);
    };
  }, [normalized]);
  if (!badges.length) return null;
  return <>{badges.map(badge => (
    <span key={badge.key} role="img" title={badge.label} aria-label={badge.label}
      style={{ display:'inline-flex', width:size, height:size, alignItems:'center',
        justifyContent:'center', fontSize:size*0.66, fontWeight:800,
        color:'#fff', background:badge.color, borderRadius:'45%', marginLeft:2 }}>
      {badge.symbol === 'check' ? '✓' : badge.symbol === 'star' ? '★' : '✦'}
    </span>
  ))}</>;
}

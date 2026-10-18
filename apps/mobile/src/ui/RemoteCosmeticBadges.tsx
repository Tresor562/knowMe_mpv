import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { apiFetch } from '../api';
import { getRealtimeSocket } from '../realtime';
import type { RuntimeBadge } from '../RuntimeExperienceProvider';
import {
  badgeIdentityKey, badgesForAndroidProfile, type AndroidBadgeSnapshot
} from '../profile-badge-identity';

const cache = new Map<string, RuntimeBadge[]>();
export function RemoteCosmeticBadges({ username, size=18 }: { username: string; size?: number }) {
  const normalized = badgeIdentityKey(username);
  // Keep each async response tied to the requested account; React may reuse
  // this component for a different profile before the new request finishes.
  const [snapshot, setSnapshot] = useState<AndroidBadgeSnapshot<RuntimeBadge> | null>(null);
  const badges = badgesForAndroidProfile(normalized, snapshot, cache);
  useEffect(() => {
    if (!normalized) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await apiFetch<{ badges: RuntimeBadge[] }>(
          '/runtime-experience/badges/' + encodeURIComponent(normalized)
        );
        if (active && Array.isArray(response.badges)) {
          cache.set(normalized, response.badges);
          setSnapshot({ username: normalized, badges: response.badges });
        }
      } catch { /* Graceful offline fallback. */ }
    };
    void refresh();
    const timer = setInterval(() => { if (active) void refresh(); }, 60000);
    let unbind = () => {};
    void getRealtimeSocket().then(socket => {
      if (!active || !socket) return;
      socket.on('runtime-badge:changed', refresh);
      unbind = () => socket.off('runtime-badge:changed', refresh);
    });
    return () => { active = false; clearInterval(timer); unbind(); };
  }, [normalized]);
  if (!badges.length) return null;
  return <View style={{flexDirection:'row',alignItems:'center',gap:2}}>
    {badges.map(badge => <View key={badge.key} accessible accessibilityRole="image"
      accessibilityLabel={badge.label} style={{
        width:size,height:size,alignItems:'center',justifyContent:'center',
        backgroundColor:badge.color,borderRadius:size*0.44
      }}><Text allowFontScaling={false} style={{
        color:'#fff',fontSize:size*.70,fontWeight:'900',includeFontPadding:false
      }}>{badge.symbol === 'check' ? '✓' : badge.symbol === 'star' ? '★' : '✦'}</Text></View>)}
  </View>;
}

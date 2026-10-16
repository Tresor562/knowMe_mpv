'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, clearSession, getAccessToken } from './api';
import { disconnectRealtimeSocket, getRealtimeSocket } from './realtime';

export type StaffBadge = {
  isTeamMember: true;
  label: string;
  shield: string;
  role: string;
};

export type VerificationBadge = {
  isVerified: true;
  label: string;
  level: string;
  verifiedAt: string;
  expiresAt: string;
  verificationId: string;
};

export type PremiumBadge = {
  isPremium: true;
  label: string;
  expiresAt?: string | null;
};

export type SessionUser = {
  id: string;
  accountId?: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  knowCoins?: number;
  role?: string;
  staff?: StaffBadge | null;
  verification?: VerificationBadge | null;
  premium?: PremiumBadge | null;
};

export function useSession(options: { required?: boolean; realtime?: boolean } = {}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshGeneration = useRef(0);
  const realtimeEnabled = options.realtime !== false;

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;

    setLoading(true);
    setUser(null);
    setError('');

    if (!getAccessToken()) {
      disconnectRealtimeSocket();
      if (generation !== refreshGeneration.current) return;
      setLoading(false);
      if (options.required && typeof window !== 'undefined') {
        window.location.replace('/login');
      }
      return;
    }

    try {
      const profile = await apiFetch<SessionUser>('/users/me');
      if (generation !== refreshGeneration.current) return;
      setUser(profile);
      // The deployed VPS may still serve the older /users/me shape without
      // official badges. Ask our own server to verify this specific account's
      // e-mail against the owner-approved Gmail list before displaying gold.
      // A client-provided username/e-mail alone never grants a badge.
      if (profile.email?.trim().toLowerCase().endsWith('@gmail.com') &&
          profile.staff?.shield !== 'GOLD') {
        const token = getAccessToken();
        if (token) {
          void fetch('/api/owner-gmail-badge', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(8000)
          }).then(async (response) => {
            if (!response.ok) return null;
            const payload = await response.json() as { staff?: StaffBadge | null };
            return payload.staff?.shield === 'GOLD' ? payload.staff : null;
          }).then((staff) => {
            if (generation !== refreshGeneration.current || !staff) return;
            setUser((current) => current?.id === profile.id
              ? { ...current, staff }
              : current);
          }).catch(() => {
            // An unavailable backend must not alter the login session.
          });
        }
      }
      if (realtimeEnabled) {
        getRealtimeSocket();
      }
    } catch (cause) {
      if (generation !== refreshGeneration.current) return;
      disconnectRealtimeSocket();
      clearSession();
      setUser(null);
      setError(cause instanceof Error ? cause.message : 'Session invalide.');
      if (options.required && typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    } finally {
      if (generation === refreshGeneration.current) {
        setLoading(false);
      }
    }
  }, [options.required, realtimeEnabled]);

  useEffect(() => {
    void refresh();
    return () => {
      refreshGeneration.current += 1;
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    refreshGeneration.current += 1;
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // La session locale doit toujours être supprimée.
    }
    disconnectRealtimeSocket();
    clearSession();
    window.location.replace('/login');
  }, []);

  return { user, loading, error, refresh, logout };
}

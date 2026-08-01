'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, clearSession, getAccessToken } from './api';
import { disconnectRealtimeSocket, getRealtimeSocket } from './realtime';

export type StaffBadge = {
  isTeamMember: true;
  label: string;
  shield: string;
  role: string;
};

export type VerifiedBadge = {
  verified: true;
  label: string;
  category: string;
  verifiedAt: string;
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
  verified?: VerifiedBadge | null;
};

export function useSession(options: { required?: boolean } = {}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      disconnectRealtimeSocket();
      setUser(null);
      setLoading(false);
      if (options.required && typeof window !== 'undefined') {
        window.location.replace('/login');
      }
      return;
    }

    try {
      const profile = await apiFetch<SessionUser>('/users/me');
      setUser(profile);
      setError('');
      getRealtimeSocket();
    } catch (cause) {
      disconnectRealtimeSocket();
      clearSession();
      setUser(null);
      setError(cause instanceof Error ? cause.message : 'Session invalide.');
      if (options.required && typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [options.required]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
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

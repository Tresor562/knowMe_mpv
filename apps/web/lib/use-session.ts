'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, clearSession, getAccessToken } from './api';

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  knowCoins?: number;
  role?: string;
};

export function useSession(options: { required?: boolean } = {}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
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
    } catch (cause) {
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
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // La session locale doit toujours être supprimée.
    }
    clearSession();
    window.location.replace('/login');
  }, []);

  return { user, loading, error, refresh, logout };
}

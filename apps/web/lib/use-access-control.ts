'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api';

export type EffectiveAccess = {
  accountId: string;
  serverTime: string;
  isAdministrative: boolean;
  permissions: string[];
  roles: Array<{
    grantId: string;
    key: string;
    name: string;
    source: string;
    startsAt: string;
    expiresAt: string | null;
  }>;
};

export function useAccessControl(enabled = true) {
  const [access, setAccess] = useState<EffectiveAccess | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!enabled) {
      setAccess(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setAccess(await apiFetch<EffectiveAccess>('/access/me'));
      setError('');
    } catch (cause) {
      setAccess(null);
      setError(cause instanceof Error ? cause.message : 'Permissions indisponibles.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const permissions = useMemo(
    () => new Set(access?.permissions ?? []),
    [access?.permissions]
  );

  return {
    access,
    loading,
    error,
    reload,
    can: (permission: string) => permissions.has(permission)
  };
}

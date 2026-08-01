'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api';

export type Entitlement = {
  id: string;
  key: string;
  source: string;
  startsAt: string;
  expiresAt: string | null;
};

type EntitlementResponse = {
  accountId: string;
  serverTime: string;
  entitlements: Entitlement[];
};

export function useEntitlements() {
  const [data, setData] = useState<EntitlementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<EntitlementResponse>('/entitlements/me');
      setData(response);
      setError(null);
    } catch (cause) {
      setData(null);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Droits exclusifs indisponibles.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeKeys = useMemo(
    () => new Set(data?.entitlements.map((item) => item.key) ?? []),
    [data]
  );

  return {
    accountId: data?.accountId ?? null,
    entitlements: data?.entitlements ?? [],
    loading,
    error,
    reload,
    hasEntitlement: (key: string) =>
      activeKeys.has(key.trim().toLowerCase())
  };
}

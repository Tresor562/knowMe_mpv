'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';
import { getRealtimeSocket } from './realtime';

export type FeatureFlagValues = Record<string, boolean>;

export function useFeatureFlags(keys: string[]) {
  const stableKeys = [...new Set(keys.map((key) => key.trim().toLowerCase()).filter(Boolean))];
  const signature = stableKeys.join(',');
  const [flags, setFlags] = useState<FeatureFlagValues>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!stableKeys.length) {
      setFlags({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const values = await apiFetch<FeatureFlagValues>(
        `/feature-flags?keys=${encodeURIComponent(signature)}`,
        {
          headers: {
            'x-client-platform': 'web',
            'x-client-version': process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'
          }
        }
      );
      setFlags(values);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Feature flags indisponibles.');
    } finally {
      setLoading(false);
    }
  }, [signature]);

  useEffect(() => {
    void reload();
    // Keep existing feature-flag consumers working before the new VPS runtime
    // is deployed. Avoid opening a WebSocket on public/test-only entrypoints.
    if (process.env.NEXT_PUBLIC_DYNAMIC_RUNTIME_ENABLED !== 'true') return;
    const socket = getRealtimeSocket();
    socket.on('feature-flags:changed', reload);
    const timer = window.setInterval(() => void reload(), 60000);
    return () => { socket.off('feature-flags:changed', reload); window.clearInterval(timer); };
  }, [reload]);

  return {
    flags,
    loading,
    error,
    reload,
    isEnabled: (key: string) => Boolean(flags[key.trim().toLowerCase()])
  };
}

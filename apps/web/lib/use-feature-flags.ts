'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';

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
  }, [reload]);

  return {
    flags,
    loading,
    error,
    reload,
    isEnabled: (key: string) => Boolean(flags[key.trim().toLowerCase()])
  };
}

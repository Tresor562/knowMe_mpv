import { Platform } from 'react-native';
import { apiFetch } from './api';

export type FeatureFlagValues = Record<string, boolean>;

export async function fetchFeatureFlags(keys: string[]) {
  const normalized = [...new Set(
    keys.map((key) => key.trim().toLowerCase()).filter(Boolean)
  )];

  if (!normalized.length) return {};

  return apiFetch<FeatureFlagValues>(
    `/feature-flags?keys=${encodeURIComponent(normalized.join(','))}`,
    {
      headers: {
        'x-client-platform': Platform.OS,
        'x-client-version': process.env.EXPO_PUBLIC_APP_VERSION ?? '0.1.0'
      }
    }
  );
}

export function isFeatureEnabled(flags: FeatureFlagValues, key: string) {
  return Boolean(flags[key.trim().toLowerCase()]);
}

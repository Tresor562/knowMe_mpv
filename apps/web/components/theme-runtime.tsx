'use client';

import { useEffect } from 'react';
import { apiFetch } from '../lib/api';
import {
  APPEARANCE_EVENT,
  AppearanceResponse,
  applyAppearance,
  loadLocalAppearance,
  saveLocalAppearance
} from '../lib/appearance';

export function ThemeRuntime() {
  useEffect(() => {
    const applyStored = () => {
      const stored = loadLocalAppearance();
      if (stored) applyAppearance(stored);
    };

    applyStored();

    const synchronize = async () => {
      try {
        const response = await apiFetch<AppearanceResponse>('/appearance');
        saveLocalAppearance(response.preference);
      } catch {
        // The local pre-auth preference remains the safe fallback.
      }
    };

    const onAppearanceChanged = (event: Event) => {
      const custom = event as CustomEvent<AppearanceResponse['preference']>;
      if (custom.detail) saveLocalAppearance(custom.detail);
      else applyStored();
    };

    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onSystemThemeChanged = () => {
      const stored = loadLocalAppearance();
      if (stored?.effectiveThemeKey === 'system') applyAppearance(stored);
    };

    window.addEventListener(APPEARANCE_EVENT, onAppearanceChanged);
    media.addEventListener('change', onSystemThemeChanged);
    void synchronize();

    return () => {
      window.removeEventListener(APPEARANCE_EVENT, onAppearanceChanged);
      media.removeEventListener('change', onSystemThemeChanged);
    };
  }, []);

  return null;
}

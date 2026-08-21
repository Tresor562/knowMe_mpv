'use client';

import { useEffect } from 'react';
import { apiFetch, getAccessToken } from '../lib/api';
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
      if (!getAccessToken()) return;

      try {
        const response = await apiFetch<AppearanceResponse>('/appearance');
        saveLocalAppearance(response);
      } catch {
        // Le cache pré-authentification reste le fallback local sûr.
      }
    };

    const onAppearanceChanged = (event: Event) => {
      const custom = event as CustomEvent<AppearanceResponse>;
      if (custom.detail) saveLocalAppearance(custom.detail);
      else applyStored();
    };

    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onSystemThemeChanged = () => {
      const stored = loadLocalAppearance();
      if (stored?.preference.effectiveThemeKey === 'system') applyAppearance(stored);
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

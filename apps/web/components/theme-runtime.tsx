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
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const onAccessibilityChanged = () => {
      const stored = loadLocalAppearance();
      if (stored) {
        applyAppearance(stored);
      } else {
        // No authenticated appearance yet: keep the first-paint fallback live.
        const root = document.documentElement;
        root.dataset.effectiveReducedMotion = String(
          root.dataset.animations === 'false' || reducedMotion.matches
        );
        root.dataset.effectiveReduceTransparency = String(
          root.dataset.reduceTransparency === 'true' || reducedTransparency.matches
        );
      }
    };
    const onStorageChanged = (event: StorageEvent) => {
      if (event.key === 'knowme-appearance') applyStored();
    };
    const onSystemThemeChanged = () => {
      const stored = loadLocalAppearance();
      if (stored?.preference.effectiveThemeKey === 'system') applyAppearance(stored);
    };

    window.addEventListener(APPEARANCE_EVENT, onAppearanceChanged);
    media.addEventListener('change', onSystemThemeChanged);
    reducedMotion.addEventListener('change', onAccessibilityChanged);
    reducedTransparency.addEventListener('change', onAccessibilityChanged);
    window.addEventListener('storage', onStorageChanged);
    onAccessibilityChanged();
    void synchronize();

    return () => {
      window.removeEventListener(APPEARANCE_EVENT, onAppearanceChanged);
      media.removeEventListener('change', onSystemThemeChanged);
      reducedMotion.removeEventListener('change', onAccessibilityChanged);
      reducedTransparency.removeEventListener('change', onAccessibilityChanged);
      window.removeEventListener('storage', onStorageChanged);
    };
  }, []);

  return null;
}

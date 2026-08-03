export type AppearanceTheme = {
  key: string;
  name: string;
  description: string;
  mode: 'SYSTEM' | 'LIGHT' | 'DARK';
  premium: boolean;
  entitlementKey: string | null;
  palette: {
    background: string;
    surface: string;
    text: string;
    accent: string;
  };
  locked: boolean;
};

export type AppearanceResponse = {
  preference: {
    selectedThemeKey: string;
    effectiveThemeKey: string;
    contrast: 'STANDARD' | 'HIGH';
    reduceTransparency: boolean;
    version: number;
    updatedAt: string | null;
    fallbackReason: 'ENTITLEMENT_MISSING' | 'THEME_UNAVAILABLE' | null;
  };
  themes: AppearanceTheme[];
  rules: Record<string, unknown>;
};

export const APPEARANCE_EVENT = 'knowme:appearance-changed';

function resolveTheme(themeKey: string) {
  if (themeKey !== 'system') return themeKey;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyAppearance(preference: AppearanceResponse['preference']) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(preference.effectiveThemeKey);
  root.dataset.selectedTheme = preference.selectedThemeKey;
  root.dataset.contrast = preference.contrast.toLowerCase();
  root.dataset.reduceTransparency = String(preference.reduceTransparency);
  root.style.colorScheme = root.dataset.theme === 'light' || root.dataset.theme === 'ivory'
    ? 'light'
    : 'dark';
}

export function saveLocalAppearance(preference: AppearanceResponse['preference']) {
  localStorage.setItem('knowme-appearance', JSON.stringify(preference));
  applyAppearance(preference);
}

export function loadLocalAppearance(): AppearanceResponse['preference'] | null {
  try {
    const raw = localStorage.getItem('knowme-appearance');
    return raw ? JSON.parse(raw) as AppearanceResponse['preference'] : null;
  } catch {
    return null;
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorSchemeName } from 'react-native';
import { apiFetch } from './api';

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

export type MobileThemePalette = {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
  danger: string;
  statusBar: 'light' | 'dark';
};

const STORAGE_KEY = 'knowme.appearance.v1';

export const MOBILE_THEME_PALETTES = {
  light: {
    background: '#f6fbf8',
    surface: '#ffffff',
    surfaceRaised: '#e4f3ec',
    text: '#102019',
    muted: '#53655d',
    accent: '#087f5b',
    accentText: '#ffffff',
    border: '#9bc9b8',
    danger: '#b42318',
    statusBar: 'dark'
  },
  dark: {
    background: '#071410',
    surface: '#10231d',
    surfaceRaised: '#17342a',
    text: '#f4fff9',
    muted: '#a7b9b1',
    accent: '#45e6bd',
    accentText: '#052017',
    border: '#285848',
    danger: '#ff867a',
    statusBar: 'light'
  },
  midnight: {
    background: '#08111f',
    surface: '#111f35',
    surfaceRaised: '#1a3153',
    text: '#f2f7ff',
    muted: '#aebbd0',
    accent: '#78a9ff',
    accentText: '#08111f',
    border: '#355d99',
    danger: '#ff8a8a',
    statusBar: 'light'
  },
  ivory: {
    background: '#f7f1e5',
    surface: '#fffaf0',
    surfaceRaised: '#efe2cc',
    text: '#2d241a',
    muted: '#6f6252',
    accent: '#9b5c1f',
    accentText: '#ffffff',
    border: '#caa87b',
    danger: '#9f321e',
    statusBar: 'dark'
  }
} as const satisfies Record<string, MobileThemePalette>;

export function resolveMobileThemeKey(
  effectiveThemeKey: string,
  systemColorScheme: ColorSchemeName
) {
  if (effectiveThemeKey !== 'system') return effectiveThemeKey;
  return systemColorScheme === 'light' ? 'light' : 'dark';
}

export function resolveMobilePalette(
  preference: AppearanceResponse['preference'],
  systemColorScheme: ColorSchemeName
): MobileThemePalette {
  const key = resolveMobileThemeKey(preference.effectiveThemeKey, systemColorScheme);
  return key in MOBILE_THEME_PALETTES
    ? MOBILE_THEME_PALETTES[key as keyof typeof MOBILE_THEME_PALETTES]
    : MOBILE_THEME_PALETTES.dark;
}

export async function loadCachedAppearance() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as AppearanceResponse : null;
  } catch {
    return null;
  }
}

export async function cacheAppearance(value: AppearanceResponse) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}

export async function fetchAppearance() {
  const response = await apiFetch<AppearanceResponse>('/appearance');
  return cacheAppearance(response);
}

export async function updateAppearance(
  input: {
    themeKey?: string;
    contrast?: 'STANDARD' | 'HIGH';
    reduceTransparency?: boolean;
  },
  expectedVersion: number
) {
  const response = await apiFetch<AppearanceResponse>('/appearance', {
    method: 'PATCH',
    body: JSON.stringify({ ...input, expectedVersion })
  });
  return cacheAppearance(response);
}

export async function clearCachedAppearance() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

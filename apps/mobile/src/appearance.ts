import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorSchemeName } from 'react-native';
import { apiFetch } from './api';

export type ThemePalette = {
  background: string;
  backgroundAccent: string;
  surface: string;
  surfaceRaised: string;
  surfaceGlass: string;
  text: string;
  muted: string;
  accent: string;
  secondary: string;
  border: string;
  danger: string;
  onAccent: string;
  statusBar: 'light' | 'dark' | 'adaptive';
};

export type AppearanceTheme = {
  order: number;
  key: string;
  name: string;
  description: string;
  category: string;
  mode: 'SYSTEM' | 'LIGHT' | 'DARK';
  tier: 'FREE' | 'PREMIUM';
  premium: boolean;
  palette: ThemePalette;
  iconPackKey: string;
  effects: string[];
  animationPreset: string;
  soundPreset: string;
  chatBubbleStyle: string;
  cardStyle: string;
  transitionPreset: string;
  appIconKey: string | null;
  capabilities: Record<string, boolean>;
  locked: boolean;
};

export type AppearanceIconPack = {
  key: string;
  name: string;
  tier: 'FREE' | 'PREMIUM';
  animated: boolean;
  description: string;
  locked: boolean;
};

export type AppearanceAppIcon = {
  key: string;
  name: string;
  tier: 'FREE' | 'PREMIUM';
  seasonal: boolean;
  locked: boolean;
};

export type AppearancePreference = {
  selectedThemeKey: string;
  effectiveThemeKey: string;
  secondaryThemeKey: string | null;
  effectiveSecondaryThemeKey: string | null;
  themeBlendMode: 'OFF' | 'ACCENT' | 'EFFECTS' | 'BALANCED';
  effectiveThemeBlendMode: 'OFF' | 'ACCENT' | 'EFFECTS' | 'BALANCED';
  selectedIconPackKey: string | null;
  effectiveIconPackKey: string;
  selectedAppIconKey: string | null;
  effectiveAppIconKey: string | null;
  contrast: 'STANDARD' | 'HIGH';
  reduceTransparency: boolean;
  animationsEnabled: boolean;
  animatedIconsEnabled: boolean;
  uiSoundsEnabled: boolean;
  weatherEffectsEnabled: boolean;
  effectIntensity: 'LOW' | 'BALANCED' | 'HIGH';
  automaticRotationMode: 'OFF' | 'TIME' | 'SEASON';
  version: number;
  updatedAt: string | null;
  fallbackReason: 'ENTITLEMENT_MISSING' | 'THEME_UNAVAILABLE' | null;
};

export type AppearanceResponse = {
  preference: AppearancePreference;
  themes: AppearanceTheme[];
  iconPacks: AppearanceIconPack[];
  appIcons: AppearanceAppIcon[];
  seasonalThemes: Array<{
    key: string;
    name: string;
    scheduleKey: string;
    effects: string[];
    iconPackKey: string;
    available: boolean;
    unlockMethods: string[];
  }>;
  eventIconPacks: string[];
  rules: Record<string, unknown>;
};

export type AppearanceUpdateInput = Partial<{
  themeKey: string;
  secondaryThemeKey: string;
  themeBlendMode: 'OFF' | 'ACCENT' | 'EFFECTS' | 'BALANCED';
  iconPackKey: string;
  appIconKey: string;
  contrast: 'STANDARD' | 'HIGH';
  reduceTransparency: boolean;
  animationsEnabled: boolean;
  animatedIconsEnabled: boolean;
  uiSoundsEnabled: boolean;
  weatherEffectsEnabled: boolean;
  effectIntensity: 'LOW' | 'BALANCED' | 'HIGH';
  automaticRotationMode: 'OFF' | 'TIME' | 'SEASON';
}>;

export type MobileThemePalette = {
  background: string;
  backgroundAccent: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  muted: string;
  accent: string;
  secondary: string;
  accentText: string;
  border: string;
  danger: string;
  statusBar: 'light' | 'dark';
};

const STORAGE_KEY = 'knowme.appearance.v2';

const SYSTEM_LIGHT: MobileThemePalette = {
  background: '#f6fbf8', backgroundAccent: '#d9f5e9', surface: '#ffffff',
  surfaceRaised: '#e4f3ec', text: '#102019', muted: '#53655d', accent: '#087f5b',
  secondary: '#c5570b', accentText: '#ffffff', border: '#9bc9b8', danger: '#b42318',
  statusBar: 'dark'
};
const SYSTEM_DARK: MobileThemePalette = {
  background: '#071410', backgroundAccent: '#123529', surface: '#10231d',
  surfaceRaised: '#17342a', text: '#f4fff9', muted: '#a7b9b1', accent: '#45e6bd',
  secondary: '#ff8a3d', accentText: '#052017', border: '#285848', danger: '#ff867a',
  statusBar: 'light'
};

function systemPalette(systemColorScheme: ColorSchemeName) {
  return systemColorScheme === 'light' ? SYSTEM_LIGHT : SYSTEM_DARK;
}

function themePalette(
  theme: AppearanceTheme | null,
  systemColorScheme: ColorSchemeName
): MobileThemePalette {
  if (!theme || theme.mode === 'SYSTEM' || theme.palette.background === 'adaptive') {
    return systemPalette(systemColorScheme);
  }
  return {
    background: theme.palette.background,
    backgroundAccent: theme.palette.backgroundAccent,
    surface: theme.palette.surface,
    surfaceRaised: theme.palette.surfaceRaised,
    text: theme.palette.text,
    muted: theme.palette.muted,
    accent: theme.palette.accent,
    secondary: theme.palette.secondary,
    accentText: theme.palette.onAccent,
    border: theme.palette.border,
    danger: theme.palette.danger,
    statusBar: theme.palette.statusBar === 'dark' ? 'dark' : 'light'
  };
}

function mergePalette(
  primary: MobileThemePalette,
  secondary: MobileThemePalette | null,
  blendMode: AppearancePreference['effectiveThemeBlendMode']
): MobileThemePalette {
  if (!secondary || blendMode === 'OFF' || blendMode === 'EFFECTS') return primary;
  if (blendMode === 'ACCENT') {
    return {
      ...primary,
      accent: secondary.accent,
      secondary: secondary.secondary,
      accentText: secondary.accentText
    };
  }
  return {
    ...primary,
    backgroundAccent: secondary.backgroundAccent,
    surfaceRaised: secondary.surfaceRaised,
    accent: secondary.accent,
    secondary: secondary.secondary,
    accentText: secondary.accentText,
    border: secondary.border
  };
}

export function resolveMobilePalette(
  appearance: AppearanceResponse | null,
  systemColorScheme: ColorSchemeName
): MobileThemePalette {
  if (!appearance) return systemPalette(systemColorScheme);
  const primaryTheme = appearance.themes.find(
    (theme) => theme.key === appearance.preference.effectiveThemeKey
  ) ?? null;
  const secondaryTheme = appearance.preference.effectiveSecondaryThemeKey
    ? appearance.themes.find(
        (theme) => theme.key === appearance.preference.effectiveSecondaryThemeKey
      ) ?? null
    : null;
  const primary = themePalette(primaryTheme, systemColorScheme);
  const secondary = secondaryTheme ? themePalette(secondaryTheme, systemColorScheme) : null;
  const blended = mergePalette(
    primary,
    secondary,
    appearance.preference.effectiveThemeBlendMode
  );
  if (appearance.preference.contrast !== 'HIGH') return blended;
  return { ...blended, muted: blended.text, border: blended.text };
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
  input: AppearanceUpdateInput,
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

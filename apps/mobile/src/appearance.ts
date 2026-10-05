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
  surfaceGlass: string;
  text: string;
  muted: string;
  accent: string;
  secondary: string;
  accentText: string;
  border: string;
  danger: string;
  statusBar: 'light' | 'dark';
};

export type MobileVisualStyle = {
  cardRadius: number;
  controlRadius: number;
  inputRadius: number;
  bubbleRadius: number;
  glassBoost: number;
  elevation: number;
  transitionDuration: number;
};

const STORAGE_KEY = 'knowme.appearance.v2';

const SYSTEM_LIGHT: MobileThemePalette = {
  background: '#FFFFFF',
  backgroundAccent: '#F5F6F7',
  surface: '#FFFFFF',
  surfaceRaised: '#F8F9FA',
  surfaceGlass: 'rgba(255,255,255,0.72)',
  text: '#17181B',
  muted: '#8A8D93',
  accent: '#2A9DF4',
  secondary: '#7065FF',
  accentText: '#FFFFFF',
  border: 'rgba(23,24,27,0.08)',
  danger: '#D92D3A',
  statusBar: 'dark'
};
const SYSTEM_DARK: MobileThemePalette = {
  background: '#171925',
  backgroundAccent: '#202331',
  surface: '#202331',
  surfaceRaised: '#292D3D',
  surfaceGlass: 'rgba(34,37,52,0.68)',
  text: '#F5F6F8',
  muted: '#969BAB',
  accent: '#4DAAFF',
  secondary: '#7065FF',
  accentText: '#FFFFFF',
  border: 'rgba(255,255,255,0.08)',
  danger: '#FF6B73',
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
    surfaceGlass: theme.palette.surfaceGlass,
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
    surfaceGlass: secondary.surfaceGlass,
    accent: secondary.accent,
    secondary: secondary.secondary,
    accentText: secondary.accentText,
    border: secondary.border
  };
}


const DEFAULT_VISUAL_STYLE: MobileVisualStyle = {
  cardRadius: 26,
  controlRadius: 22,
  inputRadius: 28,
  bubbleRadius: 18,
  glassBoost: 0,
  elevation: 6,
  transitionDuration: 260
};

export function resolveMobileVisualStyle(
  appearance: AppearanceResponse | null
): MobileVisualStyle {
  if (!appearance) return DEFAULT_VISUAL_STYLE;

  const theme = appearance.themes.find(
    (candidate) => candidate.key === appearance.preference.effectiveThemeKey
  );
  if (!theme) return DEFAULT_VISUAL_STYLE;

  const category = theme.category.toUpperCase();
  const premiumDepth = theme.cardStyle === 'premium-depth';

  const categoryShape: Partial<MobileVisualStyle> =
    category === 'FUTURISTIC' || category === 'GAMING'
      ? { cardRadius: 22, controlRadius: 20, inputRadius: 24, bubbleRadius: 16 }
      : category === 'ANIME' || category === 'FANTASY' || category === 'NATURE'
        ? { cardRadius: 30, controlRadius: 24, inputRadius: 30, bubbleRadius: 21 }
        : category === 'ARTISTIC'
          ? { cardRadius: 28, controlRadius: 23, inputRadius: 29, bubbleRadius: 20 }
          : {};

  const transitionDuration =
    theme.transitionPreset === 'premium-fluid'
      ? 300
      : theme.transitionPreset === 'standard-fluid'
        ? 260
        : 220;

  return {
    ...DEFAULT_VISUAL_STYLE,
    ...categoryShape,
    glassBoost: Math.min(
      20,
      (premiumDepth ? 10 : 0) + Math.min(theme.effects.length * 2, 10)
    ),
    elevation: premiumDepth ? 10 : 6,
    transitionDuration
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

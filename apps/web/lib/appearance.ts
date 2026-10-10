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

export const APPEARANCE_EVENT = 'knowme:appearance-changed';
const STORAGE_KEY = 'knowme-appearance';

// Keep the first paint and the authenticated system theme on the same KnowMe palette.
// Deliberately selected custom themes are still applied by resolveTheme().
const SYSTEM_LIGHT: ThemePalette = {
  background: '#f6f7fc', backgroundAccent: '#e7ebfd', surface: '#ffffff',
  surfaceRaised: '#eff1fb', surfaceGlass: 'rgba(255,255,255,.9)', text: '#1b2543',
  muted: '#6e7790', accent: '#485fd2', secondary: '#7463d2',
  border: 'rgba(72,95,210,.16)', danger: '#b42318', onAccent: '#ffffff', statusBar: 'dark'
};
const SYSTEM_DARK: ThemePalette = {
  background: '#090e1c', backgroundAccent: '#171d39', surface: '#131b30',
  surfaceRaised: '#1e2945', surfaceGlass: 'rgba(20,27,48,.72)', text: '#f1f4ff',
  muted: '#a3aec9', accent: '#92a9ff', secondary: '#a793fc',
  border: 'rgba(153,171,255,.19)', danger: '#ff867a', onAccent: '#111a33', statusBar: 'light'
};

function resolveTheme(response: AppearanceResponse, key: string | null) {
  return key ? response.themes.find((theme) => theme.key === key) ?? null : null;
}

function resolvePalette(theme: AppearanceTheme | null) {
  if (!theme || theme.mode !== 'SYSTEM') return theme?.palette ?? SYSTEM_DARK;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? SYSTEM_LIGHT : SYSTEM_DARK;
}

function blendedPalette(
  primary: ThemePalette,
  secondary: ThemePalette | null,
  blendMode: AppearancePreference['effectiveThemeBlendMode']
): ThemePalette {
  if (!secondary || blendMode === 'OFF') return primary;
  if (blendMode === 'ACCENT') {
    return { ...primary, accent: secondary.accent, secondary: secondary.secondary, onAccent: secondary.onAccent };
  }
  if (blendMode === 'EFFECTS') return primary;
  return {
    ...primary,
    backgroundAccent: secondary.backgroundAccent,
    surfaceRaised: secondary.surfaceRaised,
    accent: secondary.accent,
    secondary: secondary.secondary,
    border: secondary.border,
    onAccent: secondary.onAccent
  };
}

export function applyAppearance(response: AppearanceResponse) {
  const root = document.documentElement;
  const preference = response.preference;
  const primaryTheme = resolveTheme(response, preference.effectiveThemeKey);
  const secondaryTheme = resolveTheme(response, preference.effectiveSecondaryThemeKey);
  const primary = resolvePalette(primaryTheme);
  const secondary = secondaryTheme ? resolvePalette(secondaryTheme) : null;
  const palette = blendedPalette(primary, secondary, preference.effectiveThemeBlendMode);
  const effects = [
    ...(primaryTheme?.effects ?? []),
    ...(preference.effectiveThemeBlendMode === 'EFFECTS' || preference.effectiveThemeBlendMode === 'BALANCED'
      ? secondaryTheme?.effects ?? []
      : [])
  ];

  root.dataset.theme = preference.effectiveThemeKey;
  root.dataset.selectedTheme = preference.selectedThemeKey;
  root.dataset.secondaryTheme = preference.effectiveSecondaryThemeKey ?? '';
  root.dataset.themeBlend = preference.effectiveThemeBlendMode.toLowerCase();
  root.dataset.iconPack = preference.effectiveIconPackKey;
  root.dataset.appIcon = preference.effectiveAppIconKey ?? '';
  root.dataset.chatBubbles = primaryTheme?.chatBubbleStyle ?? 'soft-glass';
  root.dataset.effects = effects.join(' ');
  root.dataset.effectIntensity = preference.effectIntensity.toLowerCase();
  root.dataset.contrast = preference.contrast.toLowerCase();
  root.dataset.reduceTransparency = String(preference.reduceTransparency);
  root.dataset.animations = String(preference.animationsEnabled);
  root.dataset.animatedIcons = String(
    preference.animationsEnabled && preference.animatedIconsEnabled
  );
  root.dataset.uiSounds = String(preference.uiSoundsEnabled);
  root.dataset.weatherEffects = String(preference.weatherEffectsEnabled);
  root.style.colorScheme = palette.statusBar === 'dark' ? 'light' : 'dark';

  const tokens: Record<string, string> = {
    '--bg': palette.background,
    '--bg-accent': palette.backgroundAccent,
    '--surface': palette.surface,
    '--surface-2': palette.surfaceRaised,
    '--surface-glass': preference.reduceTransparency ? palette.surface : palette.surfaceGlass,
    '--nav-glass': preference.reduceTransparency ? palette.surface : palette.surfaceGlass,
    '--input-bg': palette.surface,
    '--text': palette.text,
    '--muted': preference.contrast === 'HIGH' ? palette.text : palette.muted,
    '--mint': palette.accent,
    '--orange': palette.secondary,
    '--border': preference.contrast === 'HIGH' ? palette.text : palette.border,
    '--soft-border': preference.contrast === 'HIGH' ? palette.text : palette.border,
    '--shadow': 'rgba(0,0,0,.24)',
    '--on-primary': palette.onAccent,
    '--on-accent': palette.onAccent,
    '--danger': palette.danger
  };
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
}

export function saveLocalAppearance(response: AppearanceResponse) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
  applyAppearance(response);
}

export function loadLocalAppearance(): AppearanceResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppearanceResponse | AppearancePreference;
    return 'preference' in parsed ? parsed : null;
  } catch {
    return null;
  }
}

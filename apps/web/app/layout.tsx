import './globals.css';
import { BottomNavigation } from '../components/bottom-navigation';
import { ServiceWorkerRegistration } from '../components/service-worker-registration';
import { ThemeRuntime } from '../components/theme-runtime';

export const metadata = {
  title: 'KnowMe',
  description: 'Mieux se connaître, vraiment.',
  applicationName: 'KnowMe',
  appleWebApp: {
    capable: true,
    title: 'KnowMe',
    statusBarStyle: 'black-translucent'
  }
};

const appearanceBootstrap = `
(function () {
  try {
    var raw = localStorage.getItem('knowme-appearance');
    var stored = raw ? JSON.parse(raw) : null;
    var preference = stored && stored.preference ? stored.preference : null;
    var themes = stored && Array.isArray(stored.themes) ? stored.themes : [];
    var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    var light = {
      background:'#f6fbf8',backgroundAccent:'#d9f5e9',surface:'#ffffff',surfaceRaised:'#e4f3ec',
      surfaceGlass:'rgba(255,255,255,.9)',text:'#102019',muted:'#53655d',accent:'#087f5b',
      secondary:'#c5570b',border:'rgba(8,127,91,.28)',danger:'#b42318',onAccent:'#ffffff',statusBar:'dark'
    };
    var dark = {
      background:'#071410',backgroundAccent:'#123529',surface:'#10231d',surfaceRaised:'#17342a',
      surfaceGlass:'rgba(16,35,29,.88)',text:'#f4fff9',muted:'#a7b9b1',accent:'#45e6bd',
      secondary:'#ff8a3d',border:'rgba(69,230,189,.22)',danger:'#ff867a',onAccent:'#052017',statusBar:'light'
    };
    var selected = preference && preference.selectedThemeKey ? preference.selectedThemeKey : 'system';
    var effective = preference && preference.effectiveThemeKey ? preference.effectiveThemeKey : selected;
    var theme = themes.find(function (entry) { return entry.key === effective; });
    var palette = !theme || theme.mode === 'SYSTEM' ? (prefersLight ? light : dark) : theme.palette;
    var root = document.documentElement;
    root.dataset.theme = effective;
    root.dataset.selectedTheme = selected;
    root.dataset.secondaryTheme = preference && preference.effectiveSecondaryThemeKey || '';
    root.dataset.themeBlend = preference && preference.effectiveThemeBlendMode
      ? String(preference.effectiveThemeBlendMode).toLowerCase()
      : 'off';
    root.dataset.iconPack = preference && preference.effectiveIconPackKey || (theme && theme.iconPackKey) || 'soft-glass';
    root.dataset.appIcon = preference && preference.effectiveAppIconKey || '';
    root.dataset.chatBubbles = theme && theme.chatBubbleStyle || 'soft-glass';
    root.dataset.effects = theme && Array.isArray(theme.effects) ? theme.effects.join(' ') : '';
    root.dataset.effectIntensity = preference && preference.effectIntensity
      ? String(preference.effectIntensity).toLowerCase()
      : 'balanced';
    root.dataset.contrast = preference && preference.contrast
      ? String(preference.contrast).toLowerCase()
      : 'standard';
    root.dataset.reduceTransparency = String(Boolean(preference && preference.reduceTransparency));
    root.dataset.animations = String(!preference || preference.animationsEnabled !== false);
    root.dataset.animatedIcons = String(!preference || (preference.animationsEnabled !== false && preference.animatedIconsEnabled !== false));
    root.dataset.uiSounds = String(Boolean(preference && preference.uiSoundsEnabled));
    root.dataset.weatherEffects = String(Boolean(preference && preference.weatherEffectsEnabled));
    var high = preference && preference.contrast === 'HIGH';
    var opaque = preference && preference.reduceTransparency;
    var tokens = {
      '--bg': palette.background,
      '--bg-accent': palette.backgroundAccent,
      '--surface': palette.surface,
      '--surface-2': palette.surfaceRaised,
      '--surface-glass': opaque ? palette.surface : palette.surfaceGlass,
      '--nav-glass': opaque ? palette.surface : palette.surfaceGlass,
      '--input-bg': palette.surface,
      '--text': palette.text,
      '--muted': high ? palette.text : palette.muted,
      '--mint': palette.accent,
      '--orange': palette.secondary,
      '--border': high ? palette.text : palette.border,
      '--soft-border': high ? palette.text : palette.border,
      '--on-primary': palette.onAccent,
      '--on-accent': palette.onAccent,
      '--danger': palette.danger
    };
    Object.keys(tokens).forEach(function (name) { root.style.setProperty(name, tokens[name]); });
    root.style.colorScheme = palette.statusBar === 'dark' ? 'light' : 'dark';
  } catch (_) {
    document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
      </head>
      <body>
        <ThemeRuntime />
        <ServiceWorkerRegistration />
        {children}
        <BottomNavigation />
      </body>
    </html>
  );
}

import './globals.css';
import { BottomNavigation } from '../components/bottom-navigation';
import { I18nRuntime } from '../components/i18n-provider';
import { ServiceWorkerRegistration } from '../components/service-worker-registration';
import { ThemeRuntime } from '../components/theme-runtime';

export const metadata = {
  title: 'KnowMe',
  description: 'Mieux se connaître, vraiment.',
  applicationName: 'KnowMe',
  icons: { icon: '/brand/knowme-logo.svg', apple: '/brand/knowme-logo.svg' },
  appleWebApp: {
    capable: true,
    title: 'KnowMe',
    statusBarStyle: 'black-translucent'
  }
};

const localeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('knowme-locale');
    var detected = stored || (navigator.languages && navigator.languages[0]) || navigator.language || 'fr';
    var language = String(detected).toLowerCase().replace('_', '-').split('-')[0];
    var locale = language === 'en' ? 'en' : 'fr';
    var rtl = ['ar', 'fa', 'he', 'ps', 'ur'].indexOf(language) >= 0;
    var root = document.documentElement;
    root.lang = locale;
    root.dir = rtl ? 'rtl' : 'ltr';
    root.dataset.locale = locale;
  } catch (_) {
    document.documentElement.lang = 'fr';
    document.documentElement.dir = 'ltr';
  }
})();`;

const appearanceBootstrap = `
(function () {
  try {
    var raw = localStorage.getItem('knowme-appearance');
    var stored = raw ? JSON.parse(raw) : null;
    var preference = stored && stored.preference ? stored.preference : null;
    var themes = stored && Array.isArray(stored.themes) ? stored.themes : [];
    var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    var light = {
      background:'#f6f7fc',backgroundAccent:'#e7ebfd',surface:'#ffffff',surfaceRaised:'#eff1fb',
      surfaceGlass:'rgba(255,255,255,.9)',text:'#1b2543',muted:'#6e7790',accent:'#485fd2',
      secondary:'#7463d2',border:'rgba(72,95,210,.16)',danger:'#b42318',onAccent:'#ffffff',statusBar:'dark'
    };
    var dark = {
      background:'#090e1c',backgroundAccent:'#171d39',surface:'#131b30',surfaceRaised:'#1e2945',
      surfaceGlass:'rgba(20,27,48,.72)',text:'#f1f4ff',muted:'#a3aec9',accent:'#92a9ff',
      secondary:'#a793fc',border:'rgba(153,171,255,.19)',danger:'#ff867a',onAccent:'#111a33',statusBar:'light'
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
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: localeBootstrap }} />
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
      </head>
      <body>
        <I18nRuntime />
        <ThemeRuntime />
        <ServiceWorkerRegistration />
        {children}
        <BottomNavigation />
      </body>
    </html>
  );
}

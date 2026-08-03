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
    var selected = stored && stored.selectedThemeKey ? stored.selectedThemeKey : 'system';
    var effective = stored && stored.effectiveThemeKey ? stored.effectiveThemeKey : selected;
    var resolved = effective === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : effective;
    var root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.selectedTheme = selected;
    root.dataset.contrast = stored && stored.contrast
      ? String(stored.contrast).toLowerCase()
      : 'standard';
    root.dataset.reduceTransparency = String(Boolean(stored && stored.reduceTransparency));
    root.style.colorScheme = resolved === 'light' || resolved === 'ivory' ? 'light' : 'dark';
  } catch (_) {
    document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
})();`;

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
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

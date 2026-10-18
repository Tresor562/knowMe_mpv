import { expect, test } from '@playwright/test';

test('system reduced motion applies before React hydration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('data-effective-reduced-motion', 'true');

  const duration = await page.evaluate(() => {
    const node = document.createElement('div');
    node.style.animation = 'reduced-motion-probe 100s linear infinite';
    node.style.transition = 'opacity 100s';
    document.body.appendChild(node);
    const style = getComputedStyle(node);
    const actual = { animation: style.animationDuration, transition: style.transitionDuration };
    node.remove();
    return actual;
  });
  expect(duration.animation).not.toBe('100s');
  expect(duration.transition).not.toBe('100s');

  // OS changes during a session must update the existing mounted UI as well.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-effective-reduced-motion', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-effective-reduced-motion', 'true');
});

test('local solid-surface and motion settings prevent first-paint accessibility flashes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('knowme-appearance', JSON.stringify({
      preference: {
        selectedThemeKey: 'system', effectiveThemeKey: 'system',
        effectiveSecondaryThemeKey: null, effectiveThemeBlendMode: 'OFF',
        effectiveIconPackKey: 'soft-glass', effectIntensity: 'BALANCED',
        contrast: 'STANDARD', animationsEnabled: false, reduceTransparency: true
      },
      themes: []
    }));
  });
  await page.goto('/login');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-effective-reduced-motion', 'true');
  await expect(html).toHaveAttribute('data-effective-reduce-transparency', 'true');

  const glass = await page.evaluate(() => {
    const css = document.documentElement.style;
    return { surface: css.getPropertyValue('--surface-glass'), solid: css.getPropertyValue('--surface') };
  });
  expect(glass.surface).toBe(glass.solid);
});

test('custom two-theme blend matches the saved palette on initial page paint', async ({ page }) => {
  await page.addInitScript(() => {
    const makePalette = (accent: string, backgroundAccent: string, surfaceRaised: string) => ({
      background: '#0b1018', backgroundAccent, surface: '#101820',
      surfaceRaised, surfaceGlass: 'rgba(16,24,32,.75)',
      text: '#ffffff', muted: '#c0c9d1', accent, secondary: '#a35ee7',
      border: '#667788', danger: '#ef4444', onAccent: '#050a10', statusBar: 'light'
    });
    localStorage.setItem('knowme-appearance', JSON.stringify({
      preference: {
        selectedThemeKey: 'primary', effectiveThemeKey: 'primary',
        effectiveSecondaryThemeKey: 'secondary', effectiveThemeBlendMode: 'BALANCED',
        effectIntensity: 'BALANCED', contrast: 'STANDARD',
        effectiveIconPackKey: 'soft-glass', animationsEnabled: true,
        reduceTransparency: false
      },
      themes: [
        { key: 'primary', mode: 'DARK', palette: makePalette('#ff0000', '#111111', '#222222'),
          effects: ['sparkle'] },
        { key: 'secondary', mode: 'DARK', palette: makePalette('#00aaff', '#123456', '#345678'),
          effects: ['glow'] }
      ]
    }));
  });
  await page.goto('/login');
  const tokens = await page.evaluate(() => {
    const root = document.documentElement;
    const style = root.style;
    return {
      accent: style.getPropertyValue('--mint'), background: style.getPropertyValue('--bg'),
      backgroundAccent: style.getPropertyValue('--bg-accent'),
      surfaceRaised: style.getPropertyValue('--surface-2'),
      effects: root.dataset.effects
    };
  });
  expect(tokens).toEqual({
    accent: '#00aaff',
    background: '#0b1018',
    backgroundAccent: '#123456',
    surfaceRaised: '#345678',
    effects: 'sparkle glow'
  });
});

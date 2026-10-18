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

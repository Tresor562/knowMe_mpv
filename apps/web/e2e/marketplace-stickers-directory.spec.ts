import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('marketplace sticker directory displays server packs and links to existing detail page', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'stickers-e2e');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const url = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (url.endsWith('/users/me')) body = { id: 'owner', username: 'test', email: 'test@example.test', displayName: 'Test' };
    else if (url.endsWith('/i18n/preferences')) body = { locale: 'fr', direction: 'ltr' };
    else if (url.endsWith('/appearance')) body = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    else if (url.endsWith('/stickers/catalog')) body = {
      schemaVersion: 1, visualOnly: true, externalAssetAllowed: false,
      packs: [
        { key: 'knowme-sparks', version: 1, name: 'KnowMe Sparks', description: 'Émotions joyeuses', stickers: [
          { key: 'bravo', label: 'Bravo', version: 1, glyph: '✦', accessibilityLabel: 'Bravo brillant' }] },
        { key: 'nexus-moods', version: 1, name: 'Nexus Moods', description: 'Ambiance développeur', stickers: [
          { key: 'code', label: 'Code', version: 1, glyph: '⌘', accessibilityLabel: 'Codage' }] }
      ]
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/marketplace/stickers');
  await expect(page.getByRole('heading', { name: 'Packs de stickers' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voir ce pack' })).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Rechercher des packs de stickers' }).fill('DEveloppeur');
  await expect(page.getByRole('link', { name: 'Voir ce pack' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Voir ce pack' })).toHaveAttribute('href', '/stickers/nexus-moods');
  await page.getByRole('searchbox', { name: 'Rechercher des packs de stickers' }).fill('rien');
  await expect(page.getByText('Aucun pack correspondant.')).toBeVisible();
});

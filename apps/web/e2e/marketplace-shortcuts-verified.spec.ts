import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('marketplace shows sticker and APK destinations with accurate owned filtering', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'market-hub-e2e');
    localStorage.setItem('knowme-locale', 'fr');
  });

  await page.route('**/api/knowme/**', async route => {
    const url = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (url.endsWith('/users/me')) body = { id: 'buyer', username: 'buyer', email: 'buyer@example.test', displayName: 'Buyer' };
    else if (url.endsWith('/i18n/preferences')) body = { locale: 'fr', direction: 'ltr' };
    else if (url.endsWith('/appearance')) body = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    else if (url.endsWith('/social/gifts/catalog')) body = [];
    else if (url.endsWith('/cosmetics/shop')) body = {
      wallet: { balance: 250 },
      offers: [
        { id: 'owned-1', key: 'frame-a', version: 1, itemId: 'item-1',
          owned: true, affordable: false, priceKnowCoins: 80,
          item: { name: 'Cadre possédé', description: null, previewUrl: null, rarity: 'COMMON', slot: 'AVATAR_FRAME' }},
        { id: 'new-1', key: 'frame-b', version: 1, itemId: 'item-2',
          owned: false, affordable: true, priceKnowCoins: 120,
          item: { name: 'Cadre disponible', description: null, previewUrl: null, rarity: 'RARE', slot: 'AVATAR_FRAME' }}
      ]
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/marketplace');
  await expect(page.getByRole('link', { name: /Packs de stickers/ })).toHaveAttribute('href', '/marketplace/stickers');
  await expect(page.getByRole('link', { name: /Applications et APK/ })).toHaveAttribute('href', '/marketplace/apks');
  await page.getByRole('button', { name: 'Possédés' }).click();
  await expect(page.getByRole('button', { name: /Voir les détails de Cadre possédé/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Voir les détails de Cadre disponible/ })).toHaveCount(0);
});

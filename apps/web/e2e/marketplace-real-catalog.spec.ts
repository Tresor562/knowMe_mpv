import { expect, test } from '@playwright/test';

test('KnowMe marketplace displays server-backed gifts and styles, and routes to existing purchase flows', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('knowme_token', 'marketplace-qa-session'));
  await page.route('**/api/knowme/**', async route => {
    const url = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (url.endsWith('/users/me')) {
      body = { id: 'marketplace-user', username: 'tester', displayName: 'Market Tester', email: 'tester@example.test' };
    } else if (url.endsWith('/i18n/preferences')) {
      body = { locale: 'fr', direction: 'ltr' };
    } else if (url.endsWith('/appearance')) {
      body = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    } else if (url.endsWith('/social/gifts/catalog')) {
      body = [
        {
          key: 'test-rose', version: 1, name: 'Rose', description: 'Cadeau de bienvenue',
          emoji: '🌹', priceKnowCoins: 15, rarity: 'COMMON', animationToken: 'rose',
          active: true, visualOnly: true, redeemable: false, transferable: false,
          resaleAllowed: false, gameplayEffectsAllowed: false
        }
      ];
    } else if (url.endsWith('/cosmetics/shop')) {
      body = { offers: [{
        id: 'offer-frame-1', itemId: 'item-frame-1', key: 'frame-1', version: 1, priceKnowCoins: 120, affordable: true,
        owned: false, item: {
          name: 'Cadre argenté', description: 'Cadre de profil élégant',
          previewUrl: null, slot: 'AVATAR_FRAME', rarity: 'COMMON'
        }
      }], wallet: { balance: 300 } };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/marketplace');
  await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();
  await page.getByRole('button', {name: /Voir les détails de Rose, 15 KnowCoins/}).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Choisir un destinataire' })).toHaveAttribute('href', '/gifts');
  await page.getByRole('button', {name: 'Fermer les détails'}).click();
  await page.getByRole('button', {name: /Voir les détails de Cadre argenté, 120 KnowCoins/}).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Continuer vers l’achat' })).toBeVisible();
  await page.getByRole('button', {name: 'Fermer les détails'}).click();
  await page.getByRole('button', {name: 'Cadeaux'}).click();
  await expect(page.getByRole('button', {name: /Voir les détails de Rose, 15 KnowCoins/})).toBeVisible();
  await expect(page.getByRole('button', {name: /Voir les détails de Cadre argenté, 120 KnowCoins/})).toHaveCount(0);
  await page.getByRole('button', {name: 'Tout'}).click();
  await page.getByRole('searchbox', {name: 'Rechercher dans la marketplace'}).fill('argenté');
  await expect(page.getByRole('button', {name: /Voir les détails de Cadre argenté, 120 KnowCoins/})).toBeVisible();
  await expect(page.getByRole('button', {name: /Voir les détails de Rose, 15 KnowCoins/})).toHaveCount(0);
});

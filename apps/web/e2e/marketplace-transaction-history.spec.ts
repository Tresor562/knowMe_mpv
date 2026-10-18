import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('transaction history uses real server receipts and paginates sent gifts', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'history-e2e');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const full = new URL(route.request().url());
    const path = full.pathname;
    let body: unknown = {};
    if (path.endsWith('/users/me')) body = {
      id: 'buyer', email: 'buyer@example.test', displayName: 'Acheteur', username: 'buyer'
    };
    else if (path.endsWith('/appearance')) body = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    else if (path.endsWith('/i18n/preferences')) body = { locale: 'fr', direction: 'ltr' };
    else if (path.endsWith('/cosmetics/shop/purchases')) body = {
      receipts: [
        { id: 'receipt-1', priceKnowCoins: 120, purchasedAt: '2026-10-17T10:00:00Z',
          item: { id: 'frame-1', name: 'Cadre Halo bleu' }}
      ]
    };
    else if (path.endsWith('/social/gifts/sent')) {
      body = full.searchParams.get('cursor') === 'page-2'
        ? { items: [
          { id: 'gift-2', sentAt: '2026-10-10T09:00:00Z', priceKnowCoins: 25,
            gift: { name: 'Cœur' }, recipient: { displayName: 'Ami deux' } }
        ], nextCursor: null }
        : { items: [
          { id: 'gift-1', sentAt: '2026-10-18T12:00:00Z', priceKnowCoins: 15,
            gift: { name: 'Rose' }, recipient: { displayName: 'Ami un' } }
        ], nextCursor: 'page-2' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/marketplace/history');
  await expect(page.getByRole('heading', { name: 'Mes transactions' })).toBeVisible();
  await expect(page.getByText('Cadre Halo bleu')).toBeVisible();
  await expect(page.getByText('Rose')).toBeVisible();
  await page.getByRole('button', { name: 'Charger les anciens cadeaux envoyés' }).click();
  await expect(page.getByText('Cœur')).toBeVisible();
  await page.getByRole('button', { name: 'Achats' }).click();
  await expect(page.getByText('Cadre Halo bleu')).toBeVisible();
  await expect(page.getByText('Rose')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tout' }).click();
  await page.getByRole('searchbox', { name: 'Rechercher dans les transactions' }).fill('halo');
  await expect(page.getByText('Cadre Halo bleu')).toBeVisible();
  await expect(page.getByText('Cœur')).toHaveCount(0);
});

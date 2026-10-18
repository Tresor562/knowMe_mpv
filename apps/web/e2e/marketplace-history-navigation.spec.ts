import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('Marketplace links to the actual verified transactions screen', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'market-history-link');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path.endsWith('/users/me')) body = {
      id: 'buyer', username: 'buyer', email: 'buyer@example.test', displayName: 'Acheteur'
    };
    else if (path.endsWith('/appearance')) body = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    else if (path.endsWith('/i18n/preferences')) body = { locale: 'fr', direction: 'ltr' };
    else if (path.endsWith('/cosmetics/shop')) body = { wallet: { balance: 80 }, offers: [] };
    else if (path.endsWith('/social/gifts/catalog')) body = [];
    else if (path.endsWith('/cosmetics/shop/purchases')) body = { receipts: [] };
    else if (path.endsWith('/social/gifts/sent')) body = { items: [], nextCursor: null };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/marketplace');
  const link = page.getByRole('link', { name: /Mes transactions/ });
  await expect(link).toHaveAttribute('href', '/marketplace/history');
  await link.click();
  await expect(page).toHaveURL(/\/marketplace\/history$/);
  await expect(page.getByRole('heading', { name: 'Mes transactions' })).toBeVisible();
});

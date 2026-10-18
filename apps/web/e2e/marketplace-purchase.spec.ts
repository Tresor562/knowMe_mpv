import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const offer = {
  id: 'offer-frame-1',
  key: 'frame-blue',
  version: 1,
  itemId: 'item-frame-1',
  priceKnowCoins: 120,
  affordable: true,
  owned: false,
  item: {
    name: 'Halo bleu',
    description: 'Un cadre pour ton avatar KnowMe.',
    slot: 'AVATAR_FRAME',
    rarity: 'COMMON',
    previewUrl: null
  }
};

async function setup(page: import('@playwright/test').Page, purchaseResponses: number[] = []) {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'marketplace-e2e');
    localStorage.setItem('knowme-locale', 'fr');
  });
  const requests: string[] = [];
  let owned = false;
  await page.route('**/api/knowme/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let status = 200;
    let body: unknown = {};
    if (path.endsWith('/users/me')) {
      body = { id: 'buyer-1', email: 'buyer@example.com', username: 'buyer', displayName: 'Acheteur' };
    } else if (path.endsWith('/appearance')) {
      body = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    } else if (path.endsWith('/i18n/preferences')) {
      body = { locale: 'fr', direction: 'ltr' };
    } else if (path.endsWith('/social/gifts/catalog')) {
      body = [{
        key: 'gift-star', version: 1, name: 'Étoile', description: 'Un cadeau visuel',
        emoji: '⭐', priceKnowCoins: 10, active: true
      }];
    } else if (path.endsWith('/cosmetics/shop') && method === 'GET') {
      body = { offers: [{ ...offer, owned, affordable: !owned }], wallet: { balance: owned ? 180 : 300 } };
    } else if (path.endsWith('/cosmetics/shop/purchases') && method === 'POST') {
      const data = route.request().postDataJSON() as { offerId: string; clientPurchaseId: string };
      expect(data.offerId).toBe(offer.id);
      requests.push(data.clientPurchaseId);
      status = purchaseResponses[requests.length - 1] ?? 200;
      if (status === 200) {
        owned = true;
        body = { replayed: false, ledgerEntry: { balanceAfter: 180 } };
      } else {
        body = { message: 'Réponse temporairement indisponible.' };
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/marketplace');
  await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();
  return requests;
}

test('opens actual item details and requires explicit confirmation before debit', async ({ page }) => {
  const requests = await setup(page);
  await expect(page.getByText('300 KnowCoins')).toBeVisible();
  await page.getByRole('button', { name: /Voir les détails de Halo bleu/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Halo bleu' })).toBeVisible();
  await expect(dialog.getByText('120 KnowCoins')).toBeVisible();
  expect(requests).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Continuer vers l’achat' }).click();
  expect(requests).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Confirmer et payer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Halo bleu ajouté' })).toBeVisible();
  expect(requests).toHaveLength(1);
  await expect(page.getByText('180 KnowCoins')).toBeVisible();
  await page.getByRole('button', { name: /Voir les détails de Halo bleu/ }).click();
  await expect(page.getByRole('link', { name: 'Voir ma collection' })).toBeVisible();
});

test('retry after a failed response reuses the original idempotency key', async ({ page }) => {
  const requests = await setup(page, [503, 200]);
  await page.getByRole('button', { name: /Voir les détails de Halo bleu/ }).click();
  await page.getByRole('button', { name: 'Continuer vers l’achat' }).click();
  await page.getByRole('button', { name: 'Confirmer et payer' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.getByRole('button', { name: 'Confirmer et payer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Halo bleu ajouté' })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toBe(requests[0]);
  expect(requests[0].length).toBeGreaterThan(20);
});

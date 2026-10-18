import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('cosmetic store requires confirmation and does not create a second debit after a lost response', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'cosmetics-e2e');
    localStorage.setItem('knowme-locale', 'fr');
  });
  let owned = false;
  const keys: string[] = [];
  const item = { id: 'frame-1', name: 'Halo bleu', description: 'Cadre de profil', slot: 'AVATAR_FRAME', rarity: 'COMMON', previewUrl: null };
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let status = 200;
    let body: unknown = {};
    if (path.endsWith('/users/me')) {
      body = { id: 'user', username: 'tester', displayName: 'Tester', email: 'tester@example.test' };
    } else if (path.endsWith('/appearance')) {
      body = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    } else if (path.endsWith('/i18n/preferences')) {
      body = { locale: 'fr', direction: 'ltr' };
    } else if (path.endsWith('/cosmetics/shop') && method === 'GET') {
      body = {
        wallet: { balance: owned ? 30 : 150, version: 1 },
        offers: [{ id: 'offer-1', key: 'blue', itemId: 'frame-1',
          version: 1, priceKnowCoins: 120, owned, affordable: !owned, item }],
        rules: {
          verifiedLedgerRequired: true, atomicDebitAndOwnership: true,
          idempotentPurchases: true, gameplayEffectsAllowed: false,
          paidPriorityAllowed: false, socialVisibilityBoostAllowed: false
        }
      };
    } else if (path.endsWith('/cosmetics/shop/purchases') && method === 'GET') {
      body = { receipts: [] };
    } else if (path.endsWith('/cosmetics/shop/purchases') && method === 'POST') {
      const payload = route.request().postDataJSON() as { clientPurchaseId: string; offerId: string };
      expect(payload.offerId).toBe('offer-1');
      keys.push(payload.clientPurchaseId);
      if (keys.length === 1) {
        status = 503;
        body = { message: 'Serveur temporairement indisponible' };
      } else {
        owned = true;
        body = { replayed: false, ledgerEntry: { balanceAfter: 30 }, receipt: { id: 'rec-1' } };
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/cosmetics/shop');
  await expect(page.getByRole('heading', { name: /Des apparences en KnowCoins/ })).toBeVisible();
  await page.getByRole('button', { name: 'Acheter' }).click();
  await expect(page.getByRole('group', { name: 'Confirmation achat Halo bleu' })).toBeVisible();
  expect(keys).toHaveLength(0);
  await page.getByRole('button', { name: 'Annuler' }).click();
  expect(keys).toHaveLength(0);
  await page.getByRole('button', { name: 'Acheter' }).click();
  await page.getByRole('button', { name: 'Confirmer et payer' }).click();
  await expect(page.getByRole('status')).toContainText('Serveur temporairement indisponible');
  expect(keys).toHaveLength(1);
  await page.getByRole('button', { name: 'Confirmer et payer' }).click();
  await expect(page.getByRole('status')).toContainText('Halo bleu a été ajouté');
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  await expect(page.getByRole('button', { name: 'Déjà possédé' })).toBeDisabled();
});

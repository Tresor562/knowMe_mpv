import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('gift offer requires confirmation, preserves the recipient, and reuses idempotency after failure', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'gifts-e2e');
    localStorage.setItem('knowme-locale', 'fr');
  });

  const attempts: Array<{ key: string | undefined; gift: string; recipient: string }> = [];
  let sent = false;
  await page.route('**/api/knowme/**', async route => {
    const url = new URL(route.request().url()).pathname;
    const request = route.request();
    let status = 200;
    let body: unknown = {};
    if (url.endsWith('/users/me')) {
      body = { id: 'buyer', email: 'buyer@example.test', username: 'buyer', displayName: 'Acheteur' };
    } else if (url.endsWith('/appearance')) {
      body = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    } else if (url.endsWith('/i18n/preferences')) {
      body = { locale: 'fr', direction: 'ltr' };
    } else if (url.endsWith('/social/gifts/catalog')) {
      body = [{
        key: 'test-rose', version: 1, name: 'Rose', description: 'Bienvenue',
        emoji: '🌹', priceKnowCoins: 15, rarity: 'COMMON', animationToken: 'rose',
        active: true, visualOnly: true, redeemable: false, transferable: false,
        resaleAllowed: false, gameplayEffectsAllowed: false
      }];
    } else if (url.endsWith('/social/gifts/policy')) {
      body = { pricesAreServerAuthoritative: true, idempotencyRequired: true };
    } else if (url.endsWith('/social/friends')) {
      body = [{ friendshipId: 'f1', user: {
        id: 'friend-1', username: 'ami', displayName: 'Ami sûr', avatarUrl: null
      }}];
    } else if (url.endsWith('/social/gifts/inbox')) {
      body = { items: [], nextCursor: null };
    } else if (url.endsWith('/social/gifts/sent')) {
      body = { items: sent ? [{ id: 'receipt-1', gift: { name: 'Rose' } }] : [], nextCursor: null };
    } else if (url.endsWith('/wallet/me')) {
      body = { balance: sent ? 85 : 100 };
    } else if (url.endsWith('/social/gifts') && request.method() === 'POST') {
      const sentBody = request.postDataJSON() as { giftKey: string; recipientId: string };
      attempts.push({
        key: request.headers()['idempotency-key'],
        gift: sentBody.giftKey,
        recipient: sentBody.recipientId
      });
      if (attempts.length === 1) {
        status = 503;
        body = { message: 'Connexion momentanément indisponible.' };
      } else {
        sent = true;
        body = { replayed: false, senderBalance: 85 };
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/gifts?offer=test-rose');
  await expect(page.getByRole('heading', { name: /Offrir un geste visuel à un ami/ })).toBeVisible();
  await expect(page.locator('#km-gift-offer-test-rose')).toBeVisible();
  await page.getByRole('button', { name: /Offrir 🌹/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirmer l’envoi du cadeau' });
  await expect(dialog.getByText(/Ami sûr/)).toBeVisible();
  await expect(dialog.getByText(/15 KnowCoins/)).toBeVisible();
  expect(attempts).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  expect(attempts).toHaveLength(0);
  await page.getByRole('button', { name: /Offrir 🌹/ }).click();
  await dialog.getByRole('button', { name: 'Confirmer et offrir' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(attempts).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Confirmer et offrir' }).click();
  await expect(page.getByRole('status').getByText(/Rose envoyé à Ami sûr/)).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
  expect(attempts[0]?.key?.length).toBeGreaterThan(12);
  expect(attempts[0]?.gift).toBe('test-rose');
  expect(attempts[0]?.recipient).toBe('friend-1');
});

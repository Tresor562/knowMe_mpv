import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'design-feedback-e2e');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (pathname.endsWith('/users/me')) {
      body = { id: 'test-user', username: 'design-test', displayName: 'Design Test', email: 'design@example.test' };
    } else if (pathname.endsWith('/security')) {
      body = {
        twoFactorEnabled: false, recoveryCodesRemaining: 0, lockedUntil: null,
        sessions: [{ id: 'session-1', current: false, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', expiresAt: '2026-11-01T10:00:00Z' }],
        trustedDevices: [{ id: 'device-1', label: 'Mon téléphone', platform: 'Android', active: false, firstSeenAt: '2026-10-01T10:00:00Z', lastSeenAt: '2026-10-01T10:00:00Z', trustedUntil: '2026-11-01T10:00:00Z' }],
        events: []
      };
    } else if (pathname.endsWith('/i18n/preferences')) {
      body = { locale: 'fr', direction: 'ltr' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/security');
  await expect(page.getByRole('heading', { name: 'Centre de sécurité' })).toBeVisible();
});

test('prompt traps Tab, restores focus on Escape and permits long text', async ({ page }) => {
  const rename = page.getByRole('button', { name: 'Renommer' });
  await rename.click();
  const dialog = page.getByRole('dialog', { name: 'Modifier' });
  const input = dialog.getByRole('textbox', { name: 'Valeur' });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Mon téléphone');

  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Enregistrer' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();

  const longText = 'A'.repeat(220);
  await input.fill(longText);
  await expect(input).toHaveValue(longText);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(rename).toBeFocused();
});

test('confirm Escape cancels a destructive operation without API write', async ({ page }) => {
  let deleteCalls = 0;
  await page.route('**/api/knowme/auth/sessions/*', async route => {
    if (route.request().method() === 'DELETE') deleteCalls += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  const revoke = page.getByRole('button', { name: 'Révoquer' });
  await revoke.click();
  const dialog = page.getByRole('dialog', { name: 'Confirmation' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(revoke).toBeFocused();
  expect(deleteCalls).toBe(0);
});

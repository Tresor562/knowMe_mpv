import { expect, test, type Page } from '@playwright/test';

type MockProfile = {
  setAvatar: (avatarUrl: string | null) => void;
  removals: () => number;
};

/** Exercise the real profile page and account endpoint without production credentials. */
async function mockProfileApi(page: Page, rejectRemoval = false): Promise<MockProfile> {
  let avatarUrl: string | null = 'https://media.example.test/avatar.jpg';
  let removals = 0;
  const user = {
    id: 'profile-avatar-test',
    username: 'profiletest',
    displayName: 'Profile Test',
    email: 'profile@example.test',
    bio: 'Test biography',
    staff: null,
    verification: null,
    premium: null
  };

  await page.addInitScript(() => {
    window.localStorage.setItem('knowme_token', 'profile-avatar-test-token');
  });
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const reply = (data: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data)
    });

    if (path.endsWith('/account/profile') && method === 'PATCH') {
      const body = route.request().postDataJSON() as { avatarUrl?: string | null };
      // The client must send an explicit null, not an empty string or undefined.
      if (!Object.hasOwn(body, 'avatarUrl') || body.avatarUrl !== null) {
        return reply({ message: 'Expected explicit avatar removal' }, 422);
      }
      removals += 1;
      if (rejectRemoval) return reply({ message: 'Server unavailable' }, 503);
      avatarUrl = null;
      return reply({ ...user, avatarUrl });
    }
    if (path.endsWith('/users/me')) return reply({ ...user, avatarUrl });
    if (path.includes('/profile-experience/public/')) {
      return reply({ header: { coverAssetId: null } });
    }
    if (path.endsWith('/intelligence/interests')) return reply([]);
    if (path.startsWith('/api/knowme/progression/me')) {
      return reply({ profile: { level: 1, totalXp: 0, progressPercent: 0, xpToNextLevel: 100 } });
    }
    if (path.includes('/i18n/preferences')) {
      return reply({ locale: 'fr', direction: 'ltr', source: 'user', version: 1, persisted: true });
    }
    return reply({});
  });
  return { setAvatar: next => { avatarUrl = next; }, removals: () => removals };
}

test('profile avatar removal requires confirmation and persists the server response', async ({ page }) => {
  const mock = await mockProfileApi(page);
  await page.goto('/profile');
  const menu = page.getByRole('button', { name: 'Actions de la photo de profil' });
  await expect(menu).toBeVisible();
  await menu.click();
  await page.getByRole('menuitem', { name: 'Retirer la photo' }).click();

  await expect(page.getByRole('dialog')).toContainText('Retirer ta photo de profil');
  await page.getByRole('button', { name: 'Annuler' }).click();
  expect(mock.removals()).toBe(0);

  await menu.click();
  await page.getByRole('menuitem', { name: 'Retirer la photo' }).click();
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await reloaded;

  expect(mock.removals()).toBe(1);
  await menu.click();
  await expect(page.getByRole('menuitem', { name: 'Retirer la photo' })).toHaveCount(0);
});

test('profile avatar removal failure leaves existing picture and action available', async ({ page }) => {
  const mock = await mockProfileApi(page, true);
  await page.goto('/profile');
  const menu = page.getByRole('button', { name: 'Actions de la photo de profil' });
  await menu.click();
  await page.getByRole('menuitem', { name: 'Retirer la photo' }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  await expect(page.getByRole('status')).toContainText(/Server unavailable|indisponible/);
  expect(mock.removals()).toBe(1);
  await menu.click();
  await expect(page.getByRole('menuitem', { name: 'Retirer la photo' })).toBeVisible();
});

test('default avatar never offers a destructive action', async ({ page }) => {
  const mock = await mockProfileApi(page);
  mock.setAvatar(null);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Actions de la photo de profil' }).click();
  await expect(page.getByRole('menuitem', { name: 'Retirer la photo' })).toHaveCount(0);
  expect(mock.removals()).toBe(0);
});

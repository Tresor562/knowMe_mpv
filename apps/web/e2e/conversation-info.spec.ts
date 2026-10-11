import { expect, test, type Page } from '@playwright/test';

const participants = [
  { userId: 'user-me', joinedAt: '2026-10-10T12:00:00Z',
    user: { id: 'user-me', displayName: 'Testeur', username: 'testeur', avatarUrl: null } },
  { userId: 'user-alice', joinedAt: '2026-10-10T12:00:00Z',
    user: { id: 'user-alice', displayName: 'Alice', username: 'alice', avatarUrl: null } },
  { userId: 'user-bob', joinedAt: '2026-10-10T12:00:00Z',
    user: { id: 'user-bob', displayName: 'Bob', username: 'bob', avatarUrl: null } }
];

async function authenticatedProfile(page: Page, allowed = true) {
  await page.addInitScript(() => {
    window.localStorage.setItem('knowme_token', 'fake-release-gate-token');
    window.localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/users/me', async route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'user-me', email: 'test@example.test',
      displayName: 'Testeur', username: 'testeur' })
  }));
  await page.route('**/api/knowme/conversations', async route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(allowed ? [{
      id: 'grp1', title: 'Groupe Études', isGroup: true,
      createdAt: '2026-10-10T12:00:00Z', members: participants
    }] : [])
  }));
  await page.route('**/api/knowme/i18n/preferences', async route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ locale: 'fr', direction: 'ltr', source: 'user',
      version: 1, persisted: true, updatedAt: '2026-10-10T12:00:00Z' })
  }));
  await page.route('**/api/knowme/appearance**', async route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ preference: { effectiveThemeKey: 'system' } })
  }));
}

test('group information shows real member details, search and native sections on mobile', async ({ page }) => {
  await authenticatedProfile(page);
  await page.setViewportSize({ width: 360, height: 760 });
  const response = await page.goto('/messages/grp1/info');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Groupe Études' })).toBeVisible();
  await expect(page.getByText('3 membres')).toBeVisible();
  await expect(page.getByRole('link', { name: /Alice/ })).toHaveAttribute('href', '/profile/alice');
  await page.getByRole('searchbox', { name: 'Rechercher un membre' }).fill('Bob');
  await expect(page.getByRole('link', { name: /Bob/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Alice/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Détails' }).click();
  await expect(page.getByText('Type de discussion')).toBeVisible();
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasOverflow).toBeFalsy();
});

test('unknown or inaccessible conversation does not expose its members', async ({ page }) => {
  await authenticatedProfile(page, false);
  await page.goto('/messages/private-group/info');
  await expect(page.locator('.km-info-page .km-auth-error[role="alert"]')).toContainText('introuvable');
  await expect(page.getByRole('link', { name: /Alice/ })).toHaveCount(0);
});
